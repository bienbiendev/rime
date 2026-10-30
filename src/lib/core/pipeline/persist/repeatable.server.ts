import { isTempId } from '#lib/util/random.js';
import { isWithin } from '#lib/util/string.js';
import type { Dic } from '#lib/util/types.js';
import type { ConfigMap } from '../config-map/types.js';

/** A row of a repeatable field: a block, or a tree item. */
type Row = Dic & { id?: string; path?: string };
type SavedRow<R extends Row> = R & { id: string };

/** Where a kept row went: its list, and its `path.position` before the save and after. */
export type RowMove = { path: string; from: string; to: string };

export type RepeatablesDiff<R extends Row> = {
  toAdd: R[];
  toDelete: SavedRow<R>[];
  toUpdate: SavedRow<R>[];
  moved: RowMove[];
};

/** Where a row sits: `sections.2`, `menu.0._children.1`. */
export const placeOf = (row: Row) => `${row.path}.${row.position}`;

/** A row the store holds: a string id that is not a temporary one. */
export const isSaved = <R extends Row>(row: R): row is SavedRow<R> =>
  typeof row.id === 'string' && row.id !== '' && !isTempId(row.id);

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
const changesRow = (stored: Dic, incoming: Dic) =>
  Object.entries(incoming).some(([key, value]) => {
    if (key === '_children') return false;
    if (Array.isArray(value) && value[0]?.type) return false;
    return JSON.stringify(value) !== JSON.stringify(stored[key]);
  });

/**
 * What a save does to the stored rows: add the new ones, delete the stored ones it no longer sends,
 * update the ones whose values changed, and where each kept row moved. `stored` holds the rows
 * inside the saved paths only.
 */
export function diffRepeatables<R extends Row>(stored: R[], incoming: R[]): RepeatablesDiff<R> {
  const sentIds = new Set(incoming.filter(isSaved).map((row) => row.id));
  return {
    toAdd: incoming.filter((row) => !isSaved(row)),
    toDelete: stored.filter(isSaved).filter((row) => !sentIds.has(row.id)),
    toUpdate: incoming.filter(isSaved).filter((row) => {
      const match = stored.find((candidate) => candidate.id === row.id);
      return !!match && changesRow(match, row);
    }),
    moved: incoming.filter(isSaved).flatMap((row) => {
      const match = stored.find((candidate) => candidate.id === row.id);
      return match && placeOf(match) !== placeOf(row)
        ? [{ path: row.path!, from: placeOf(match), to: placeOf(row) }]
        : [];
    })
  };
}

/**
 * Where `path` lies once the rows above it have moved: the deepest move holding it decides, since
 * its `to` already carries the moves of the rows above it. `null` under no moved row.
 *
 * ```ts
 * movedPath('sections.2.image', [{ path: 'sections', from: 'sections.2', to: 'sections.1' }]);
 * // 'sections.1.image'
 * ```
 */
export const movedPath = (path: string, moves: RowMove[]) => {
  const deepest = moves
    .filter((move) => isWithin(path, move.from))
    .sort((a, b) => b.from.length - a.from.length)[0];
  return deepest ? deepest.to + path.slice(deepest.from.length) : null;
};

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
