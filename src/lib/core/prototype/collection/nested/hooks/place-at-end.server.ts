import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * Puts a new page sent without `_position` at the end of its list: one past the highest position
 * under its parent, 0 in an empty list.
 *
 * ```ts
 * // Under P: A 0, B 1
 * POST /api/pages { title: 'C', _parent: 'P' } // C 2
 * ```
 */
export const placeAtEnd = Hooks.beforeCreate(async function placeAtEnd(args) {
  const sent = args.data._position;
  if (sent !== undefined && sent !== null) return args;

  const parent = (args.data._parent as string | null | undefined) || null;
  const [last] = await args.event.locals.rime.adapter.collection(args.config.slug).findMany({
    query: { where: { _parent: parent ? { equals: parent } : { is_null: true } } },
    sort: '-_position',
    limit: 1,
    select: ['_position']
  });
  const position = typeof last?._position === 'number' ? last._position + 1 : 0;
  return { ...args, data: { ...args.data, _position: position } };
});
