import { Hooks } from '$lib/core/factory/hooks.js';

/**
 * Hook to populate _children property on document from a nested collection
 */
export const addChildrenProperty = Hooks.beforeRead(async (args) => {
  if (args.config.type !== 'collection' || !args.config.nested) return args;

  const select =
    args.context.params.select && Array.isArray(args.context.params.select)
      ? args.context.params.select
      : [];
  const emptySelect = select.length === 0;

  // If there is a select param do not populate _children just return args
  if (!emptySelect && !select.includes('_children')) return args;

  // Else populate _children
  const { rime } = args.event.locals;

  const children = await rime.adapter.collection.childrenIds({
    slug: args.config.slug,
    parentId: args.doc.id
  });

  args.doc = {
    ...args.doc,
    _children: children
  };

  return args;
});
