import type { FieldBuilder } from '$lib/core/fields/builders/index.js';
import type { RelationValue } from '$lib/types.js';
export type OmitPreservingDiscrimination<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

export type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
export type InferReturn<T> = T extends (...args: any[]) => infer R ? R : never;
export type Dic<T = any> = Record<string, T>;
export type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export type AnyFunction = (...args: any[]) => any;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<Required<T>[P]> : T[P];
};

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

export type WithoutBuilders<T> =
  T extends FieldBuilder<infer F>
    ? WithoutBuilders<F>
    : T extends Array<infer U>
      ? U extends FieldBuilder<infer F>
        ? F[]
        : U extends { compile(): infer R }
          ? R[]
          : Array<WithoutBuilders<U>>
      : T extends object
        ? T extends Function
          ? T
          : { [K in keyof T]: WithoutBuilders<T[K]> }
        : T;

type Entry<K extends PropertyKey, V> = readonly [K, V];

/**
 * Typed version of Object.fromEntries.
 * Keeps literal keys if the entries are const tuples.
 */
export function fromEntriesTyped<const E extends readonly Entry<PropertyKey, unknown>[]>(
  entries: E
): { [P in E[number] as P[0]]: P[1] } {
  return Object.fromEntries(entries as unknown as Iterable<readonly [PropertyKey, unknown]>) as {
    [P in E[number] as P[0]]: P[1];
  };
}
// export type WithoutBuilders<T> =
// 	T extends Array<infer U>
// 		? U extends FieldBuilder<any>
// 			? Field[]
// 			: Array<WithoutBuilders<U>>
// 		: T extends { fields: FieldBuilder<any>[] }
// 			? Omit<T, 'fields'> & { fields: Field[] }
// 			: T extends { tabs: Array<{ fields: FieldBuilder<any>[] }> }
// 				? Omit<T, 'tabs'> & {
// 						tabs: Array<
// 							Omit<T['tabs'][number], 'fields'> & {
// 								fields: Field[];
// 							}
// 						>;
// 					}
// 				: T extends { blocks: Array<{ fields: FieldBuilder<any>[] }> }
// 					? Omit<T, 'blocks'> & {
// 							blocks: Array<
// 								Omit<T['blocks'][number], 'fields'> & {
// 									fields: Field[];
// 								}
// 							>;
// 						}
// 					: T extends Function
// 						? T
// 						: T extends object
// 							? { [K in keyof T]: WithoutBuilders<T[K]> }
// 							: T;
