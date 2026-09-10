import type { RelationValue } from '$lib/fields/types.js';

/**
 * Type utilities that know about fields.
 *
 * They lived in util/types.ts, but both name a rime type — a relation value and a field
 * builder — so by the placement rule they belong with the concept, not with the generic
 * helpers.
 */

export type WithRelationPopulated<T> = {
  [K in keyof T]: Required<T>[K] extends string // Check for primitive types first
    ? T[K]
    : Required<T>[K] extends number
      ? T[K]
      : Required<T>[K] extends boolean
        ? T[K]
        : Required<T>[K] extends null
          ? T[K]
          : T[K] extends undefined
            ? undefined
            : // Then check for relation values
              NonNullable<T[K]> extends RelationValue<infer U>
              ? T[K] extends undefined
                ? undefined
                : U[]
              : T[K] extends Array<infer E>
                ? Array<WithRelationPopulated<E>>
                : T[K] extends object
                  ? WithRelationPopulated<T[K]>
                  : T[K];
};

/**
 * Re-exported from where it is defined: WithoutBuilders and FieldBuilder are mutually
 * recursive, so they have to share a file or import each other in a cycle.
 */
export type { WithoutBuilders } from './builders/field-builder.js';
