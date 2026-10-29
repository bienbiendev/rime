import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';

/**
 * What a config declaring `versions` has to look like.
 *
 * Same shape as `core/auth/validate-config.ts`: a built config in, its own not-versioned guard
 * first, messages out. `config/validate.server.ts` folds it in over collections and areas.
 */
export const validateVersions = (config: BuiltCollection | BuiltArea): string[] => {
  if (!config.versions) return [];

  const errors: string[] = [];

  // An auto-save is a draft row. Without drafts there is no row it could be.
  if (config.versions.autoSave && !config.versions.draft) {
    errors.push(`Versions autoSave requires draft: true (${config.slug})`);
  }

  // An upload collection does not auto-save.
  if (config.versions.autoSave && 'upload' in config && config.upload) {
    errors.push(`Versions autoSave is not supported on an upload collection (${config.slug})`);
  }

  return errors;
};
