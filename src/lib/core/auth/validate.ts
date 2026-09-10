import type { BuiltCollection } from '$lib/core/config/types.js';
import { isFormField } from '$lib/core/fields/util.js';
import { SelectFieldBuilder } from '$lib/fields/select/index.js';

/**
 * What a collection declaring `auth` has to look like.
 *
 * These rules were in `config/validate.server.ts`, which imported `isAuthConfig` to find the
 * collections they applied to — core knowing what an auth collection is, to enforce auth's own
 * requirements. They are asked through `FeatureDefinition.validate` now, and only of configs where
 * `enabled` is true, so nothing here re-tests for `auth`.
 *
 * The messages are unchanged: they are what a config author sees, and the e2e suite matches on
 * some of them.
 */
export const validateAuth = (config: BuiltCollection): string[] => {
  // Not an auth collection: nothing here applies. `enabled` used to gate this, through a seam
  // only auth ever implemented.
  if (!config.auth) return [];

  const errors: string[] = [];

  // A versioned auth collection would put credentials on a version row and leave the sign-in path
  // reading whichever version happened to be published.
  if (config.versions) {
    errors.push(`Auth collections can't be versionned (${config.slug})`);
  }

  const formFields = config.fields.filter(isFormField);
  const rolesField = formFields
    .filter((f) => f.name === 'roles')
    .filter((f) => f instanceof SelectFieldBuilder)[0];
  const nameField = formFields.filter((f) => f.name === 'name')[0];
  const emailField = formFields.find((f) => f.name === 'email' && f.type === 'email');

  if (!rolesField) errors.push(`Field roles is missing in collection ${config.slug}`);
  if (!emailField && config.auth?.type !== 'apiKey')
    errors.push(`Field email is missing in collection ${config.slug}`);
  if (!nameField) errors.push(`Field name is missing in collection ${config.slug}`);

  // Guarded: the message above already says the field is missing, and reading `.get` off nothing
  // would throw here instead of reporting.
  if (rolesField && !rolesField.get.many)
    errors.push(
      `Field roles must have "many" enabled : select('roles').options(...).many(), even with a single option`
    );

  return errors;
};
