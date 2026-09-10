import { Hooks } from '$lib/core/pipeline/define-hook.js';

/**
 * Hook to populate _children property on document from a nested collection
 */
export const addChildrenProperty = Hooks.beforeRead(async function addChildrenProperty(args) {
  // No `config.nested` check: the feature's `enabled` decides that, and the pipeline only asks
  // for this hook on a collection. See features/nested/index.ts.
  const select =
    args.context.params.select && Array.isArray(args.context.params.select)
      ? args.context.params.select
      : [];
  const emptySelect = select.length === 0;

  // If there is a select param do not populate _children just return args
  if (!emptySelect && !select.includes('_children')) return args;

  // Else populate _children
  const { rime } = args.event.locals;

  /**
   * What `childrenIds` on the adapter used to be: a filter and an order, both over columns this
   * feature put on the row. The adapter had a method named after the question.
   *
   * The ordinary document read, projected to ids — not a raw-row primitive. Everything on
   * `adapter.collection(slug)` returns documents, and a second read verb that returned ids
   * instead was a worse trade than the one join `select: ['id']` still costs. It needed
   * `buildOrderByParam` to resolve base-row columns on a versioned prototype, which it did not
   * do until 4b9db413 — `sort: '_position'` here would have silently ordered by `createdAt`.
   *
   * No `draft`/content narrowing: a parent lists every document parented to it, published or
   * not, which is what the flat query did.
   */
  const children = await rime.adapter.collection(args.config.slug).findMany({
    query: { where: { _parent: { equals: args.doc.id } } },
    sort: '_position',
    select: ['id']
  });

  args.doc = {
    ...args.doc,
    _children: children.map((child) => child.id)
  };

  return args;
});
