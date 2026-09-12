import type { VersionsConfig } from '$lib/core/prototype/shared/versions/types.js';
import type { VersionsTable } from '$lib/core/adapter.js';
import { withVersionsSuffix } from './naming.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import { text } from '$lib/fields/text/index.js';
import { toggle } from '$lib/fields/toggle/index.js';
import type { Collection } from '$lib/core/config/types.js';

type Input = {
  slug?: string;
  versions?: Collection<any>['versions'];
  fields?: Collection<any>['fields'];
};
export type WithVersionsConfig<T> = Omit<T, 'versions'> & {
  versions?: Required<VersionsConfig>;
  _versions?: VersionsTable;
};

/**
 * Normalises `versions`, adds the `status` field when drafts are on and `isAutoSave` when
 * auto-save is, and — when this config is versioned — states **where its content lives**.
 *
 * `_versions` is the answer five callers used to fold the feature list for, through a
 * `FeatureDefinition.shadow` seam that only this feature ever implemented. Two of those callers
 * are in `adapter-sqlite/`, so it has to be a config member rather than a call: reading data keeps
 * the adapter naming no feature.
 */
export const augmentVersions = <T extends Input>(config: T): WithVersionsConfig<T> => {
  const fields = [...(config.fields || [])];
  const { versions, ...rest } = config;

  let normalizedVersions: Required<VersionsConfig> | undefined;

  if (versions) {
    normalizedVersions = {
      draft: typeof versions === 'boolean' ? false : (versions.draft ?? false),
      autoSave: typeof versions === 'boolean' ? false : (versions.autoSave ?? false),
      maxVersions: typeof versions === 'boolean' ? 12 : (versions.maxVersions ?? 12)
    };

    if (normalizedVersions.draft) {
      fields.push(text('status').defaultValue(VERSIONS_STATUS.DRAFT).hidden());
    }

    // `required()` makes the column not null with a default, so a migration backfills every
    // existing row as `false`. Reads filter on `isAutoSave != true`, and SQLite does not count a
    // null row as passing that.
    if (normalizedVersions.draft && normalizedVersions.autoSave) {
      fields.push(toggle('isAutoSave').defaultValue(false).required().hidden());
    }
  } else {
    normalizedVersions = undefined;
  }

  return {
    ...rest,
    versions: normalizedVersions,
    fields,
    // Only a versioned config has a second table. `slug` is always set by `create` before the
    // augments run; the guard is for the derived configs that are built without one.
    ...(normalizedVersions && config.slug
      ? { _versions: { slug: withVersionsSuffix(config.slug) } }
      : {})
  };
};
