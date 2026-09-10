import { isAuth } from '$lib/core/auth/enabled.js';
import { isNested } from '$lib/core/prototype/collection/nested/enabled.js';
import { isUpload } from '$lib/core/prototype/collection/upload/enabled.js';
import { hasUrl } from '$lib/core/prototype/shared/url/enabled.js';
import { isVersioned } from '$lib/core/versions/enabled.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Which of the placed hooks a given config actually runs.
 *
 * A hook says whose it is — `feature: 'auth'` beside its name — and this says what that name is
 * conditional on. A name with no entry here always runs, which is the six things that used to
 * declare `enabled: () => true`.
 *
 * Was `new Map(definition.features.map((f) => [f.name, f.enabled(config)]))`, which is why
 * `PrototypeDefinition` carried a `features` list at all. Five entries, written down, beside the
 * only thing that reads them.
 */
const guards: Record<string, (config: Dic) => boolean> = {
  auth: isAuth,
  nested: isNested,
  upload: isUpload,
  url: hasUrl,
  versions: isVersioned
};

/** True when a hook belonging to `feature` runs on this config. Unowned hooks always run. */
export const featureRuns = (feature: string | undefined, config: Dic): boolean =>
  feature === undefined || (guards[feature]?.(config) ?? true);
