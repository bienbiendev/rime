/**
 * Generic type utilities. Nothing here names a rime type — that is the rule that keeps this
 * file in util/. The ones that do (WithRelationResolved, WithRelationInput, WithoutBuilders) are in
 * core/fields/types.ts.
 */

/** `Omit` applied to each member of a union, so each member keeps its own discriminant. */
export type OmitPreservingDiscrimination<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

export type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
/** `T` with every key optional, except that at least one of them must be there. */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
export type Dic<T = any> = Record<string, T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<Required<T>[P]> : T[P];
};
