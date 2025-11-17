import { filePathToFile } from '$lib/core/collections/upload/util/converter.js';
import { VersionOperations } from '$lib/core/collections/versions/operations.js';
import { VERSIONS_STATUS } from '$lib/core/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import { recursiveRemoveKeys } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import path from 'path';
import type { BuiltArea, BuiltCollection } from '../../../../types.js';
import type { ConfigMap } from '../../configMap/types.js';
import { fallbackDataFromOriginal } from '../../shared/fallback-data-from-original.js';
import { Hooks } from '../index.server.js';

/**
 * Handles version-related operations for document updates
 * Manages specific version updates and new version creation
 */
export const handleNewVersion = Hooks.beforeUpsert(async (args) => {
	const { config, event } = args;
	const { rime } = event.locals;

	const { versionOperation, originalDoc, originalConfigMap, params } = args.context;

	if (!originalConfigMap)
		throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalConfigMap @handleNewVersion');
	if (!originalDoc)
		throw new RimeError(RimeError.OPERATION_ERROR, 'missing originalDoc @handleNewVersion');
	if (!versionOperation)
		throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionOperation @handleNewVersion');

	let versionId;
	let data;

	switch (true) {
		case VersionOperations.isSpecificVersionUpdate(versionOperation):
			versionId = originalDoc.versionId;
			break;

		case VersionOperations.isNewVersionCreation(versionOperation): {
			data = await prepareDataForNewVersion({
				data: args.data,
				originalDoc,
				config,
				originalConfigMap
			});
			const versionsSlug = withVersionsSuffix(config.slug);

			const document = await rime.collection(versionsSlug).create({
				data,
				locale: params.locale
			});

			if (config.versions && config.versions.maxVersions) {
				await rime.collection(versionsSlug).delete({
					sort: '-updatedAt',
					query: 'where[status][not_equals]=published',
					offset: config.versions.maxVersions
				});
			}
			versionId = document.id;
			break;
		}

		default:
			versionId = originalDoc.id;
	}

	return {
		...args,
		context: {
			...args.context,
			params: {
				...args.context.params,
				versionId
			}
		}
	};
});

async function prepareDataForNewVersion(args: {
	data: Dic;
	config: BuiltCollection | BuiltArea;
	originalDoc: Dic;
	originalConfigMap: ConfigMap;
}) {
	const { config, originalDoc, originalConfigMap } = args;
	let data = { ...args.data };

	const isCollection = config.type === 'collection';
	// Add the original file if we are on an upload collection
	if (isCollection && config.upload && !data.file && originalDoc.filename) {
		// Create a File object from the existing file path
		const filePath = path.resolve(process.cwd(), 'static', 'medias', originalDoc.filename);
		try {
			data.file = await filePathToFile(filePath);
		} catch (err) {
			console.error(`Failed to create file from path: ${filePath}`, err);
		}
	}

	// Use missing data from original version
	data = await fallbackDataFromOriginal({
		data,
		original: originalDoc,
		configMap: originalConfigMap,
		ignore: ['status']
	});

	// Set default status to "draft" if no data.status
	if (!data.status) {
		data.status = VERSIONS_STATUS.DRAFT;
	}

	// Remove ownerId and id props from data
	data = recursiveRemoveKeys('ownerId', 'id').from(data);

	data.ownerId = originalDoc.id;
	delete data.id;

	return data;
}
