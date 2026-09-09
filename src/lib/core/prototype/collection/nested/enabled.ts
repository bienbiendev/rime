/** A collection nests its documents by declaring `nested`. */
export const isNested = (config: { nested?: unknown }): boolean => !!config.nested;
