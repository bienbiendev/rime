import type { DocumentRows } from '#lib/core/adapter.js';
import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import { ROW_BOOKKEEPING, withEmptyFields } from '#lib/core/fields/empty.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import type { RelationRow } from '#lib/fields/relation/index.js';
import { isObjectLiteral, omit } from '#lib/util/object.js';
import { enclosingRowPath } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import { unflatten } from 'flat';
import { logger } from '../logger.server.js';
import { populatedKey, type Populated } from './populate-relations.server.js';

/**
 * Assembles one document out of the rows it is stored across. Rows arrive keyed by document path,
 * and what happens to them from here is a question about documents, not about tables.
 */
export const buildDocument = async <T extends GenericDoc = GenericDoc>(
  rows: DocumentRows,
  args: {
    config: BuiltCollection | BuiltArea;
    locale?: string | undefined;
    depth?: number;
    /** What the relations point at, read ahead for the whole list. Read when `depth > 0`. */
    populated?: Populated;
    /** Every field the config declares is present, empty when nothing is stored. */
    allFields?: boolean;
    /**
     * Keep a child row's own bookkeeping on it: `position`, `path`, `ownerId`, `locale`. An editor
     * that writes blocks back in place needs it.
     */
    withRowMeta?: boolean;
  }
): Promise<T> => {
  const { config, locale, depth = 0, populated, allFields = true, withRowMeta = false } = args;

  const flatDoc: Dic = { ...rows.base };

  for (const block of rows.blocks) {
    flatDoc[`${block.path}.${block.position}`] = stripRowMeta(block, withRowMeta);
  }

  for (const node of rows.tree) {
    // Every tree node gets `_children`, empty when it has none. This sets it on the incoming row.
    if (!node._children) node._children = [];
    flatDoc[`${node.path}.${node.position}`] = stripRowMeta(node, withRowMeta);
  }

  for (const relation of rows.relations) {
    if (!relation.documentId) {
      logger.warn(`orphan ${config.slug} relation : ${relation.id}`);
      continue;
    }

    // A relation row belongs to the locale it was written in, or to every locale if it has none.
    if (relation.locale && relation.locale !== locale) continue;

    const path: string = relation.path;
    const rowPath = enclosingRowPath(path);

    // Inside a blocks or tree row, directly (`sections.3.image`) or through a group
    // (`sections.3.media.image`): that row must have been placed above. If it was not, the
    // relation outlived it, and placing it would make up a row out of the relation alone.
    if (rowPath && !flatDoc[rowPath]) {
      logger.warn(
        `Orphan ${config.slug} relation at ${path} with id ${relation.id} because its row ${rowPath} doesn't exist in the document`
      );
      continue;
    }

    let output: RelationRow | GenericDoc | null;

    if (depth > 0) {
      const target = populated?.get(
        populatedKey(relation.relationTo, relation.locale, relation.documentId)
      );
      // Missing, or not readable by this reader: the relation is left out.
      if (!target) continue;
      // A copy per placement: two documents never share an object a hook could change.
      output = structuredClone(target);
    } else {
      output = (
        withRowMeta ? relation : omit(['position', 'ownerId', 'path'], relation)
      ) as RelationRow;
    }

    flatDoc[path] = [...(flatDoc[path] || []), output];
  }

  const doc: Dic = cleanEmptyElementsInArrays(unflatten<Dic, Dic>(flatDoc));

  // A field with nothing stored reads empty, never as its default.
  return (allFields ? withEmptyFields(doc, config.fields) : doc) as T;
};

/**
 * A child row's own bookkeeping, dropped unless the caller asked to keep it.
 *
 * `path` and `position` are read before this to place the row, so they are only ever removed
 * from what the document carries, never from what the assembly needs.
 */
const stripRowMeta = (row: Dic, withRowMeta: boolean): Dic =>
  withRowMeta ? row : omit(ROW_BOOKKEEPING, row);

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
