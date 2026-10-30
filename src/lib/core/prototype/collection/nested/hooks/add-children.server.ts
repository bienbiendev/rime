import { isStaff } from '#lib/core/auth/access.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { forList } from '#lib/core/pipeline/run.server.js';
import { versionsReadQuery } from '#lib/core/prototype/shared/versions/read-query.js';

/**
 * Puts `_children` on a nested document: the ids of the documents whose `_parent` is this one,
 * ordered by `_position`. Skipped when the read's `select` names fields and `_children` is not
 * one of them.
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
  // and rime. One read for every listed document: parent id -> child ids
  const latest = args.context.isSystemOperation || isStaff(user);
  const childrenOf = await forList(args, 'nested.children', async (docs) => {
    const children = await rime.adapter.collection(args.config.slug).findMany({
      query: { where: { _parent: { in_array: docs.map((doc) => doc.id) } } },
      sort: '_position',
      select: ['id', '_parent'],
      content: versionsReadQuery({ config: args.config, params: { latest } })
    });
    const byParent = new Map<string, string[]>();
    for (const child of children) {
      const parent = child._parent as string;
      byParent.set(parent, [...(byParent.get(parent) ?? []), child.id]);
    }
    return byParent;
  });

  args.doc = { ...args.doc, _children: childrenOf.get(args.doc.id) ?? [] };
  return args;
});
