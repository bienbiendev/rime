import { RimeError } from '#lib/core/errors/index.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';

/**
 * Refuses a `_parent` that is the page itself or a page under it: the page would hang below
 * itself, and no root would reach it.
 *
 * ```ts
 * // company > services > s4
 * PATCH /api/pages/<services> { "_parent": "<s4>" } // 400
 * ```
 */
export const refuseCyclicParent = Hooks.beforeUpdate(async function refuseCyclicParent(args) {
  const id = args.context.params.id;
  const parentId = args.data._parent as string | null | undefined;
  if (!id || !parentId) return args;

  const pages = args.event.locals.rime.adapter.collection(args.config.slug);
  // Up from the new parent to the top. `seen` stops the walk on a loop already stored.
  const seen = new Set<string>();
  let current: string | null = parentId;
  while (current && !seen.has(current)) {
    if (current === id) {
      throw new RimeError(
        RimeError.BAD_REQUEST,
        `${id} cannot move under itself or a page under it`
      );
    }
    seen.add(current);
    const page = await pages.find({ id: current, select: ['_parent'] });
    current = (page?._parent as string | null | undefined) ?? null;
  }
  return args;
});
