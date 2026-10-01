import type { RelationInput, RelationRef, RelationValue } from '$lib/fields/types.js';

/**
 * Type utilities that know about fields.
 *
 * They lived in util/types.ts, but both name a rime type — a relation value and a field
 * builder — so by the placement rule they belong with the concept, not with the generic
 * helpers.
 */

/** The depths a read resolves, each mapped to the one its related documents are read at. */
type LessDepth = { 1: 0; 2: 1; 3: 2; 4: 3 };

/**
 * A document as a read at `depth` hands it back: each relation holds the related documents, read
 * themselves at one depth less. Depth 0, past 4, or a depth the type cannot know (a `number`) is
 * the document as typed, its relations refs or documents.
 *
 * ```ts
 * WithRelationResolved<PagesDoc, 1>['hero']['thumbnail']        // MediasDoc[]
 * WithRelationResolved<PagesDoc, 1>['sections'][0]['image']     // MediasDoc[], in a block too
 * WithRelationResolved<PagesDoc, 1>['author'][0]['avatar']      // RelationValue<MediasDoc>
 * ```
 */
export type WithRelationResolved<T, D extends number = 1> = D extends keyof LessDepth
  ? Resolved<T, D>
  : T;

type Resolved<T, D extends keyof LessDepth> = {
  [K in keyof T]: Required<T>[K] extends string | number | boolean | null
    ? T[K]
    : T[K] extends undefined
      ? undefined
      : T[K] extends Date | ((...args: any[]) => unknown)
        ? T[K]
        : // A list of blocks or tree items is any other array: it is walked at the same depth.
          IsRelation<NonNullable<T[K]>> extends true
          ? NonNullable<T[K]> extends RelationValue<infer U>
            ? WithRelationResolved<U, LessDepth[D]>[]
            : T[K]
          : T[K] extends Array<infer E>
            ? Array<Resolved<E, D>>
            : T[K] extends object
              ? Resolved<T[K], D>
              : T[K];
};

/** A relation's type is the only one with refs among its shapes. */
type IsRelation<V> = [Extract<V, RelationRef[]>] extends [never] ? false : true;

/**
 * A document as a write takes it: each relation also takes bare ids, in a block or a group too.
 *
 * ```ts
 * WithRelationInput<PagesDoc>['author'] // UsersDoc[] | RelationRef[] | string[] | string
 * ```
 */
export type WithRelationInput<T> = {
  [K in keyof T]: Required<T>[K] extends string | number | boolean | null
    ? T[K]
    : T[K] extends Date | ((...args: any[]) => unknown)
      ? T[K]
      : IsRelation<NonNullable<T[K]>> extends true
        ? NonNullable<T[K]> extends RelationValue<infer U>
          ? RelationInput<U>
          : T[K]
        : T[K] extends Array<infer E>
          ? Array<WithRelationInput<E>>
          : T[K] extends object
            ? WithRelationInput<T[K]>
            : T[K];
};

/**
 * Re-exported from where it is defined: WithoutBuilders and FieldBuilder are mutually
 * recursive, so they have to share a file or import each other in a cycle.
 */
export type { WithoutBuilders } from './builders/field-builder.js';
