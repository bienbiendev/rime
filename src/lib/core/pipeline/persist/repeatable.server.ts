import { isTempId } from '#lib/util/random.js';
import { isWithin } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { ConfigMap } from '../config-map/types.js';

/** A row of a repeatable field: a block, or a tree item. */
type Row = Dic & { id?: string; path?: string };
type SavedRow<R extends Row> = R & { id: string };

export type RepeatablesDiff<R extends Row> = {
  toAdd: R[];
  toDelete: SavedRow<R>[];
  toUpdate: SavedRow<R>[];
};

/** A row the store holds: an id that is not a temporary one. */
export const isSaved = <R extends Row>(row: R): row is SavedRow<R> => !!row.id && !isTempId(row.id);

/**
 * Whether the incoming row changes the stored one: a value it sends differs. Nested rows
 * (`_children`, or a list of blocks) are compared as rows of their own.
 *
 * ```ts
 * changesRow({ label: 'A', _children: [] }, { label: 'A', _children: [] }); // false
 * changesRow({ tags: ['a'] }, { tags: ['a', 'b'] }); // true
 * changesRow({ label: 'A' }, { label: 'A', subtitle: 'B' }); // true
 * ```
 */
export const changesRow = (stored: Dic, incoming: Dic) =>
  Object.entries(incoming).some(([key, value]) => {
    if (key === '_children') return false;
    if (Array.isArray(value) && value[0]?.type) return false;
    return JSON.stringify(value) !== JSON.stringify(stored[key]);
  });

/**
 * What a save does to the stored rows: add the new ones, delete the stored ones it no longer sends,
 * update the ones whose values changed. `stored` holds the rows inside the saved paths only.
 */
export function diffRepeatables<R extends Row>(stored: R[], incoming: R[]): RepeatablesDiff<R> {
  const sentIds = new Set(incoming.filter(isSaved).map((row) => row.id));
  return {
    toAdd: incoming.filter((row) => !isSaved(row)),
    toDelete: stored.filter(isSaved).filter((row) => !sentIds.has(row.id)),
    toUpdate: incoming.filter(isSaved).filter((row) => {
      const match = stored.find((candidate) => candidate.id === row.id);
      return !!match && changesRow(match, row);
    })
  };
}

/** The rows inside one of the paths a save writes. */
export const withinPaths = <R extends Row>(rows: R[], paths: string[]) =>
  rows.filter((row) => !!row.path && paths.some((path) => isWithin(row.path!, path)));

/**
 * The paths whose stored rows a save replaces: every path it sends, except a group's own. A group
 * sent with some of its members leaves the rows of the others as they are.
 *
 * ```ts
 * // PATCH { meta: { metaTitle: 'x' } }  ->  ['meta.metaTitle']: the rows of meta.gallery stay
 * // PATCH { meta: { gallery: [] } }     ->  ['meta.gallery']: the rows of meta.gallery go
 * ```
 */
export const replacedPaths = (incomingPaths: string[], configMap: ConfigMap) =>
  incomingPaths.filter((path) => configMap[path]?.type !== 'group');
