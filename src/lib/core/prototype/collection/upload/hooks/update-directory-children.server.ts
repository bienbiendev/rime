import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { RimeError } from '#lib/core/errors/index.js';
import { trycatch } from '#lib/util/function.js';

type Update = { id: string; data: { parent: string } };

/**
 * When a directory's path changes, works out the new path of each direct child, for
 * `updateDirectoryChildren` to write after the update.
 */
export const prepareDirectoryChildren = Hooks.beforeUpdate<'directory'>(
  async function prepareDirectoryChildren(args) {
    const data = args.data;
    const { event, config, context } = args;
    const originalDoc = context.originalDoc;

    if (!originalDoc)
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        'missing originalDoc @prepareDirectoryChildren'
      );

    if (data.id) {
      // `parent` is an ordinary field on the directories collection, which is never versioned,
      // so the plain query answers this.
      const children = await event.locals.rime.adapter.collection(config.slug).findMany({
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
);

/**
 * Moves the directory to the path in `data.id`, then writes the child paths
 * `prepareDirectoryChildren` worked out. Each child update runs both hooks again, so the whole
 * subtree follows.
 *
 * A directory's id is its path, and an update never writes a row's id, so the move is written
 * here: `root:a` -> `root:b:a`. The foreign key on each upload's `_path` follows it.
 */
export const updateDirectoryChildren = Hooks.afterUpdate<'directory'>(
  async function updateDirectoryChildren(args) {
    const { event, config, data } = args;
    let doc = args.doc;

    if (data.id && data.id !== doc.id) {
      await event.locals.rime.adapter.collection(config.slug).updateWhere({
        query: { where: { id: { equals: doc.id } } },
        data: { id: data.id }
      });
      doc = { ...doc, id: data.id };
    }

    // Part of the directory's update: its children are re-parented as rime
    const collection = event.locals.rime.collection(config.slug).system();
    const updates: Update[] = args.context.directoriesUpdates || [];

    for (const update of updates) {
      const [error] = await trycatch(() => collection.updateById(update));
      if (error) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'Error when updating child directories');
      }
    }

    return { ...args, doc };
  }
);
