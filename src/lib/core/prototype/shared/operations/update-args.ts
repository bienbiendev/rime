import type { WithRelationInput } from '#lib/core/fields/types.js';
import type { DeepPartial } from '#lib/util/types.js';

/** What an update names, on any prototype. A collection adds the document's `id`. */
export type UpdateArgs<T> = {
  data: DeepPartial<WithRelationInput<T>>;
  locale?: string | undefined;
  versionId?: string;
  /** Start from the newest version rather than the published one. `PARAMS.LATEST`. */
  latest?: boolean;
  /** Make a new version from the selected row rather than write it. `PARAMS.FORK`. */
  fork?: boolean;
  /** Write the caller's auto-saved row of the version `versionId` names. Panel only. */
  autoSave?: boolean;
  /** This write copies another locale's rows onto the row — see `copyLocales`. */
  isLocaleCopy?: boolean;
};
