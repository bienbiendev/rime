/** A config keeps history by declaring `versions`. */
export const isVersioned = (config: { versions?: unknown }): boolean => !!config.versions;
