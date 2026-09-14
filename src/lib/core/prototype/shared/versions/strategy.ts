import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';

/**
 * What an update does to a versioned document.
 *
 * ```
 * UPDATE                      no versions: the document's own row is written
 * UPDATE_VERSION              the selected row is written in place
 * NEW_VERSION                 a new row is made from the selected one, and written
 * NEW_AUTO_SAVE_FROM_VERSION  a new auto-saved row is made from the selected one — panel only
 * ```
 */
export const VERSIONS_OPERATIONS = {
  UPDATE: 'update',
  UPDATE_VERSION: 'update_version',
  NEW_VERSION: 'new_version',
  NEW_AUTO_SAVE_FROM_VERSION: 'new_auto_save_from_version'
} as const;

export type VersionOperation = (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];

export const VersionOperations = {
  /** A row is inserted: a new version or an auto-save. */
  isNewVersionCreation: (operation: VersionOperation) =>
    operation === VERSIONS_OPERATIONS.NEW_VERSION ||
    operation === VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION,

  /** The new row is an auto-save: the caller's own, reached by its `versionId` only. */
  isAutoSaveCreation: (operation: VersionOperation) =>
    operation === VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION,

  /** The selected row is written in place. */
  isSpecificVersionUpdate: (operation: VersionOperation) =>
    operation === VERSIONS_OPERATIONS.UPDATE_VERSION,

  /** No versions at all. */
  isSimpleUpdate: (operation: VersionOperation) => operation === VERSIONS_OPERATIONS.UPDATE
};

type Args = {
  /** A named row. */
  versionId?: string;
  /** Make a new version from the selected row rather than write it. */
  fork?: boolean;
  /** The panel typing over a document: the write lands on the caller's own auto-saved row. */
  autoSave?: boolean;
  /** Whether the row `versionId` names is already an auto-saved one. */
  originalIsAutoSave?: boolean;
  config: BuiltArea | BuiltCollection;
};

/**
 * Which row an update starts from is not decided here — `latest` and `versionId` select it, in
 * `versionsReadQuery`, the same way a read selects one. This decides what is done to it:
 *
 * ```
 * no versions                                UPDATE
 * autoSave, the named row is an auto-save    UPDATE_VERSION
 * autoSave, the named row is a version       NEW_AUTO_SAVE_FROM_VERSION
 * fork                                       NEW_VERSION
 * no drafts and no versionId                 NEW_VERSION — such a config keeps a version per save
 * otherwise                                  UPDATE_VERSION
 *
 * autoSave, on a config without it or without a versionId   BAD_REQUEST
 * ```
 *
 * Every case, as a request sees it. `latest` and `versionId` mean the same on a `GET`.
 *
 * ```
 * config                  request                              starts from   result
 * ─────────────────────── ──────────────────────────────────── ───────────── ──────────────────────────
 * no versions             PATCH                                the only row  written in place
 *
 * versions, no drafts     PATCH                                newest        new version
 * versions, no drafts     PATCH ?versionId=v1                  v1            written in place
 * versions, no drafts     PATCH ?versionId=v1&fork=true        v1            new version, copy of v1 + body
 *
 * drafts                  PATCH                                published     written in place
 * drafts                  PATCH ?latest=true                   newest        written in place
 * drafts                  PATCH ?versionId=v2                  v2            written in place
 * drafts                  PATCH ?fork=true                     published     new draft
 * drafts                  PATCH ?latest=true&fork=true         newest        new draft
 * drafts                  PATCH ?versionId=v2&fork=true        v2            new draft
 * drafts                  any of these + { status: published }               that row published, the others demoted
 * drafts, none published  PATCH                                —             404: nothing published
 * drafts, none published  PATCH ?latest=true                   newest        written in place
 *
 * auto-save (panel)       ?autoSave=true&versionId=v1          v1            new auto-saved row, status of v1
 * auto-save (panel)       ?autoSave=true&versionId=a1          a1            written in place
 * auto-save (panel)       ?versionId=a1                        a1            promoted: a version, status kept
 * ```
 *
 * The panel names the row on screen with every save (`?versionId=<row>`), adds `fork=true` for
 * "save in a new draft" and for every save on a config without drafts, and types with
 * `?autoSave=true&versionId=<row>`.
 */
export function defineVersionUpdateOperation({
  versionId,
  fork,
  autoSave,
  originalIsAutoSave,
  config
}: Args): VersionOperation {
  if (!config.versions) return VERSIONS_OPERATIONS.UPDATE;

  if (autoSave) {
    if (!config.versions.autoSave) {
      throw new RimeError(RimeError.BAD_REQUEST, `${config.slug} does not auto-save`);
    }
    if (!versionId) {
      throw new RimeError(RimeError.BAD_REQUEST, 'an auto-save names the version it starts from');
    }
    return originalIsAutoSave
      ? VERSIONS_OPERATIONS.UPDATE_VERSION
      : VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION;
  }

  if (fork) return VERSIONS_OPERATIONS.NEW_VERSION;
  if (!config.versions.draft && !versionId) return VERSIONS_OPERATIONS.NEW_VERSION;
  return VERSIONS_OPERATIONS.UPDATE_VERSION;
}
