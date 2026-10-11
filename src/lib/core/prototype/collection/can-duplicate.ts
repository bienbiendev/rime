/**
 * Whether a document of this config can be copied. An auth document is a user with an account,
 * and an upload document is a file on disk: neither has a sensible copy.
 *
 * ```ts
 * canDuplicate(pages);  // true
 * canDuplicate(staff);  // false
 * canDuplicate(medias); // false
 * ```
 */
export const canDuplicate = (config: { type: string; auth?: unknown; upload?: unknown }) =>
  config.type === 'collection' && !config.auth && !config.upload;
