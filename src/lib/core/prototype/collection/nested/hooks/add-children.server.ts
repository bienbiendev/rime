import { isStaff } from '#lib/core/auth/access.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { versionsReadQuery } from '#lib/core/prototype/shared/versions/read-query.js';

/**
 * Hook to populate _children property on document from a nested collection
 */
export const addChildrenProperty = Hooks.beforeRead(async function addChildrenProperty(args) {
  // No `config.nested` check: `when(isNested, …)` in `hooks.server.ts` places this hook on nested
  // collections only.
  const select =
    args.context.params.select && Array.isArray(args.context.params.select)
      ? args.context.params.select
      : [];
  const emptySelect = select.length === 0;

  // If there is a select param do not populate _children just return args
  if (!emptySelect && !select.includes('_children')) return args;

  // Else populate _children
  const { rime, user } = args.event.locals;

  // Children by `_parent`, ordered by `_position`: the published ones, every real one for staff
  // and rime.
  const latest = args.context.isSystemOperation || isStaff(user);
  const children = await rime.adapter.collection(args.config.slug).findMany({
    query: { where: { _parent: { equals: args.doc.id } } },
    sort: '_position',
    select: ['id'],
    content: versionsReadQuery({ config: args.config, params: { latest } })
  });

  args.doc = {
    ...args.doc,
    _children: children.map((child) => child.id)
  };

  return args;
});
