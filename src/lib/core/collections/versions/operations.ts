import type { BuiltArea, BuiltCollection } from '../../../types.js';

/**
 * Defines the different version operation strategies for document updates.
 */
export const VERSIONS_OPERATIONS = {
	UPDATE: 'update',
	UPDATE_PUBLISHED: 'update_published',
	UPDATE_VERSION: 'update_version',
	NEW_VERSION_FROM_LATEST: 'new_version_from_latest',
	NEW_DRAFT_FROM_PUBLISHED: 'new_version_from_published'
} as const;

// Create a type from the object values
export type VersionOperation = (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];

/**
 * Helper functions to check version operation types
 * These make the code more readable by replacing verbose array checks with clear function calls
 */
export const VersionOperations = {
	/**
	 * Checks if the operation creates a new version (either draft or latest)
	 * @example
	 * if (VersionOperations.isNewVersionCreation(versionOperation)) {
	 *   // Handle new version creation logic
	 * }
	 */
	isNewVersionCreation: (operation: VersionOperation) => {
		return (
			operation === VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED ||
			operation === VERSIONS_OPERATIONS.NEW_VERSION_FROM_LATEST
		);
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
	config: BuiltArea | BuiltCollection;
};

/**
 * Determines the appropriate version update operation based on configuration and parameters.
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
export function defineVersionUpdateOperation({ draft, versionId, config }: Args): VersionOperation {
	// Non-versioned documents always use simple update
	if (!config.versions) {
		return VERSIONS_OPERATIONS.UPDATE;
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
