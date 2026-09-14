import type { DocumentRows } from '$lib/core/adapter.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';
import type { Relation } from '$lib/fields/relation/index.js';
import { isObjectLiteral, omit } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import deepmerge from 'deepmerge';
import { unflatten } from 'flat';
import { logger } from '../logger.server.js';

/**
 * Assembles one document out of the rows it is stored across.
 *
 * This half used to live in the adapter, which is why the database layer merged a blank document,
 * read `event.params.panel` to decide which bookkeeping to keep, and called back up into the local
 * API to walk relations. None of it needs a table: rows arrive keyed by document path, and what
 * happens to them from here is a question about documents.
 */
export const buildDocument = async <T extends GenericDoc = GenericDoc>(
  rows: DocumentRows,
  args: {
    config: BuiltCollection | BuiltArea;
    event: RequestEvent;
    locale?: string | undefined;
    depth?: number;
    /** Merge the blank document, so every field the config declares is present. */
    withBlank?: boolean;
    /**
     * Keep a child row's own bookkeeping on it — `position`, `path`, `ownerId`, `locale` — and
     * the edit lock on the document. An API read wants the document; an editor that writes blocks
     * back in place wants the bookkeeping too.
     */
    withRowMeta?: boolean;
  }
): Promise<T> => {
  const { config, event, locale, depth = 0, withBlank = true, withRowMeta = false } = args;
  const { rime } = event.locals;

  const flatDoc: Dic = { ...rows.base };

  for (const block of rows.blocks) {
    flatDoc[`${block.path}.${block.position}`] = stripRowMeta(block, withRowMeta);
  }

  for (const node of rows.tree) {
    if (!node._children) node._children = [];
    flatDoc[`${node.path}.${node.position}`] = stripRowMeta(node, withRowMeta);
  }

  for (const relation of rows.relations) {
    if (!relation.documentId) {
      logger.warn(`orphean ${config.slug} relation : ${relation.id}`);
      continue;
    }

    // A relation row belongs to the locale it was written in, or to every locale if it has none.
    if (relation.locale && relation.locale !== locale) continue;

    const path: string = relation.path;
    const parentPath = path.split('.').slice(0, -1).join('.');

    // A parent path ending in `.<digits>` means the relation sits inside a blocks or tree array,
    // so its owner must have been placed above. If it was not, the row outlived it.
    if (/.*\.[\d]+$/.test(parentPath) && !flatDoc[parentPath]) {
      logger.warn(
        `Orphean ${config.slug} relation at ${path} with id ${relation.id} because parent path ${parentPath} doesn't exist in the document`
      );
      continue;
    }

    let output: Relation | GenericDoc | null;

    if (depth > 0) {
      output = await rime
        .collection(relation.relationTo as CollectionSlug)
        .findById({ id: relation.documentId, locale: relation.locale, depth: depth - 1 });
    } else {
      output = (
        withRowMeta ? relation : omit(['position', 'ownerId', 'path'], relation)
      ) as Relation;
    }

    flatDoc[path] = [...(flatDoc[path] || []), output];
  }

  let doc: Dic = cleanEmptyElementsInArrays(unflatten<Dic, Dic>(flatDoc));

  if (withBlank) {
    const blank = rime.config.isCollection(config.slug)
      ? rime.collection(config.slug).blank()
      : rime.area(config.slug).blank();

    doc = deepmerge(blank, doc, { arrayMerge: (_, incoming) => incoming });
  }

  return doc as T;
};

/**
 * A child row's own bookkeeping, dropped unless the caller asked to keep it.
 *
 * `path` and `position` are read before this to place the row, so they are only ever removed
 * from what the document carries, never from what the assembly needs.
 */
const stripRowMeta = (row: Dic, withRowMeta: boolean): Dic =>
  withRowMeta ? row : omit(['position', 'path', 'ownerId', 'locale'], row);

/** Drop the holes left where a row was expected and none came back. */
const cleanEmptyElementsInArrays = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanEmptyElementsInArrays(item))
      .filter((item) => item !== null && item !== undefined) as unknown as T;
  }

  if (isObjectLiteral(value)) {
    const cleaned: Dic = {};
    for (const key in value) {
      cleaned[key] = cleanEmptyElementsInArrays(value[key]);
    }
    return cleaned as T;
  }

  return value;
};
