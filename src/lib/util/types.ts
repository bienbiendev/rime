/**
 * Generic type utilities. Nothing here names a rime type — that is the rule that keeps this
 * file in util/. The two that did (WithRelationPopulated, WithoutBuilders) moved to
 * core/fields/types.ts.
 */

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
