import { augmentHooks } from '$lib/core/collections/config/augment-hooks.server.js';
import { exctractPath } from '$lib/core/collections/upload/hooks/extract-path.server.js';
import {
	prepareDirectoryChildren,
	updateDirectoryChildren
} from '$lib/core/collections/upload/hooks/update-directory-children.server.js';
import { validatePath } from '$lib/core/collections/upload/util/path.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { CollectionSlug } from '$lib/types.js';
import { toKebabCase } from '$lib/util/string.js';
import type { BuiltCollection, Config } from '../types.js';

/**
 * Creates an upload directories collection for collections with upload enabled
 * Eg. for medias this will create a collection medias_directories
 */
export function makeUploadDirectoriesCollections<C extends Config>(config: C) {
	for (const collection of config.collections || []) {
		if (collection.upload) {
			const slug = withDirectoriesSuffix(collection.slug);
			// If already created skip to the next colleciton
			// for exemple a versions collections of an upload
			// collection should not have a directories related table
			if ((config.collections || []).filter((c) => c.slug === slug).length) continue;
			// else create the directory collection
			let directoriesCollection: BuiltCollection = {
				slug: slug as CollectionSlug,
				kebab: withDirectoriesSuffix(toKebabCase(collection.slug)),
				versions: undefined,
				access: collection.access,
				fields: [
					text('id').validate(validatePath).unique().required(),
					text('name'),
					text('parent'),
					date('createdAt'),
					date('updatedAt')
				],
				type: 'collection',
				label: {
					singular: `${collection.slug} directory`,
					plural: `${collection.slug} directories`
				},
				icon: collection.icon,
				$hooks: {
					beforeUpdate: [exctractPath, prepareDirectoryChildren],
					afterUpdate: [updateDirectoryChildren],
					beforeCreate: [exctractPath]
				},
				asTitle: 'path',
				asThumbnail: collection.asThumbnail,
				panel: false,
				_generateTypes: false,
				_generateSchema: false
			};

			directoriesCollection = augmentHooks(directoriesCollection);

			config.collections = [...(config.collections || []), directoriesCollection];
		}
	}

	return config;
}
