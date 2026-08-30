import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { asc, eq } from 'drizzle-orm';

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
  const tableName = args.config.slug;
  const table = rime.adapter.getTable(tableName);

  //@ts-ignore
  const children = await rime.adapter.db.query[tableName].findMany({
    where: eq(table._parent, args.doc.id),
    orderBy: [asc(table._position)],
    columns: {
      id: true
    }
  });

  args.doc = {
    ...args.doc,
    _children: children.map((c: any) => c.id) || []
  };

  return args;
});
