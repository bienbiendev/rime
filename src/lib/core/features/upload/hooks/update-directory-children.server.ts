import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import { trycatch } from '$lib/util/function.js';

type Update = { id: string; data: { parent: string } };

export const prepareDirectoryChildren = Hooks.beforeUpdate<'directory'>({
  name: 'prepareDirectoryChildren',
  requires: [],
  provides: [],
  run: async (args) => {
    const data = args.data;
    const { event, config, context } = args;
    const originalDoc = context.originalDoc;

    if (!originalDoc)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @prepareDirectoryChildren'
      );

    if (data.id) {
      // `parent` is an ordinary field on the directories collection, which is never versioned —
      // so the normal query path answers this and no drizzle handle is needed.
      const children = await event.locals.rime.adapter.prototype(config.slug).findMany({
        query: { where: { parent: { equals: `${originalDoc.id}` } } }
      });

      const updates = children.map((childDir: any) => {
        return {
          id: childDir.id,
          data: {
            id: `${childDir.parent.replace(originalDoc.id, data.id)}:${childDir.name}`
          }
        };
      });
      args.context.directoriesUpdates = updates;
    }

    return args;
  }
});

export const updateDirectoryChildren = Hooks.afterUpdate<'directory'>({
  name: 'updateDirectoryChildren',
  requires: [],
  provides: [],
  run: async (args) => {
    const { event, config } = args;
    const collection = event.locals.rime.collection(config.slug);
    const updates: Update[] = args.context.directoriesUpdates || [];

    for (const update of updates) {
      const [error] = await trycatch(() => collection.updateById(update));
      if (error) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'Error when updating child directories');
      }
    }

    return args;
  }
});
