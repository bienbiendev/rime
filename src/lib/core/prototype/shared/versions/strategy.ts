import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';

/**
 * Defines the different version operation strategies for document updates.
 */
export const VERSIONS_OPERATIONS = {
  UPDATE: 'update',
  UPDATE_PUBLISHED: 'update_published',
  UPDATE_VERSION: 'update_version',
  NEW_VERSION_FROM_LATEST: 'new_version_from_latest',
  NEW_DRAFT_FROM_PUBLISHED: 'new_version_from_published',
  NEW_AUTO_SAVE_FROM_VERSION: 'new_auto_save_from_version'
} as const;

// Create a type from the object values
export type VersionOperation = (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];

/**
 * Helper functions to check version operation types
 * These make the code more readable by replacing verbose array checks with clear function calls
 */
export const VersionOperations = {
  /**
   * Checks if the operation creates a new version (a draft, a copy of the latest, or an auto-save)
   * @example
   * if (VersionOperations.isNewVersionCreation(versionOperation)) {
   *   // Handle new version creation logic
   * }
   */
  isNewVersionCreation: (operation: VersionOperation) => {
    return (
      operation === VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED ||
      operation === VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST ||
      operation === VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION
    );
  },

  /** The new row is an auto-save: a draft the caller owns, reached by its `versionId` only. */
  isAutoSaveCreation: (operation: VersionOperation) => {
    return operation === VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION;
  },

  /**
   * Checks if the operation is for updating a specific version
   * @example
   * if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
   *   // Handle specific version update logic
   * }
   */
  isSpecificVersionUpdate: (operation: VersionOperation) => {
    return (
      operation === VERSIONS_OPERATIONS.UPDATE_VERSION ||
      operation === VERSIONS_OPERATIONS.UPDATE_PUBLISHED
    );
  },

  /**
   * Checks if the operation requires draft status handling
   * @example
   * if (VersionOperations.requiresDraftHandling(versionOperation)) {
   *   // Set draft status
   * }
   */
  requiresDraftHandling: (operation: VersionOperation) => {
    return operation === VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED;
  },

  /**
   * Checks if the operation is for a non-versioned document
   * @example
   * if (VersionOperations.isSimpleUpdate(versionOperation)) {
   *   // Handle simple update logic
   * }
   */
  isSimpleUpdate: (operation: VersionOperation) => {
    return operation === VERSIONS_OPERATIONS.UPDATE;
  },

  /**
   * Checks if the operation is for updating a published version
   * @example
   * if (VersionOperations.isPublishedUpdate(versionOperation)) {
   *   // Handle published version update logic
   * }
   */
  isPublishedUpdate: (operation: VersionOperation) => {
    return operation === VERSIONS_OPERATIONS.UPDATE_PUBLISHED;
  },

  /**
   * Checks if the operation requires retrieving draft versions
   * Used for determining which version to fetch (draft or published)
   * @example
   * const document = await findById({
   *   id,
   *   draft: VersionOperations.shouldRetrieveDraft(versionOperation)
   * });
   */
  shouldRetrieveDraft: (operation: VersionOperation) => {
    return (
      operation === VERSIONS_OPERATIONS.UPDATE_VERSION ||
      operation === VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST
    );
  }
};

type Args = {
  draft?: boolean;
  versionId?: string;
  /** The panel typing over a document: the write lands on the caller's own auto-saved row. */
  autoSave?: boolean;
  /** Whether the row `versionId` names is already an auto-saved one. */
  originalIsAutoSave?: boolean;
  config: BuiltArea | BuiltCollection;
};

/**
 * Determines the appropriate version update operation based on configuration and parameters.
 *
 * ```
 * autoSave, on a config without it or without a versionId   BAD_REQUEST
 * autoSave, the named row is the caller's auto-save          UPDATE_VERSION
 * autoSave, the named row is a real version                  NEW_AUTO_SAVE_FROM_VERSION
 * ```
 *
 * @example
 * // Determine the operation type for a document update
 * const versionOperation = defineVersionUpdateOperation({
 *   draft: true,
 *   versionId: undefined,
 *   config: documentConfig
 * });
 *
 * // Use with helper functions for cleaner code
 * if (VersionOperations.isNewVersionCreation(versionOperation)) {
 *   // Handle new version creation logic
 * }
 *
 * @returns The appropriate version operation based on the context
 */
export function defineVersionUpdateOperation({
  draft,
  versionId,
  autoSave,
  originalIsAutoSave,
  config
}: Args): VersionOperation {
  // Non-versioned documents always use simple update
  if (!config.versions) {
    return VERSIONS_OPERATIONS.UPDATE;
  }

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

  // If a specific version ID is provided, update that version
  if (versionId) {
    return VERSIONS_OPERATIONS.UPDATE_VERSION;
  }

  // For versioned documents without draft support, create a new version
  if (!config.versions.draft) {
    return VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST;
  }

  // For versioned documents with draft support
  return draft
    ? VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED
    : VERSIONS_OPERATIONS.UPDATE_PUBLISHED;
}
