import type { WithUpload } from '$lib/core/collections/upload/util/config.js';
import { validatePath } from '$lib/core/collections/upload/util/path.js';
import { withDirectoriesSuffix } from '$lib/core/naming.js';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
import type { CollectionSlug } from '$lib/types.js';
import type { BuiltCollection } from '../types.js';

/**
 * Creates an upload directories collection for collections with upload enabled
 * Eg. for medias this will create a collection medias_directories
 */
// export function makeUploadDirectoriesCollections<C extends Config>(config: C) {
// 	for (const collection of config.collections || []) {
// 		if (collection.upload) {
// 			const slug = withDirectoriesSuffix(collection.slug);
// 			// If already created skip to the next colleciton
// 			// for exemple a versions collections of an upload
// 			// collection should not have a directories related table
// 			if ((config.collections || []).filter((c) => c.slug === slug).length) continue;

// 			const directoriesConfig = collection.upload.directories;

// 			// else create the directory collection
// 			let directoriesCollection: BuiltCollection = {
// 				slug: slug as CollectionSlug,
// 				kebab: withDirectoriesSuffix(toKebabCase(collection.slug)),
// 				versions: undefined,
// 				access: {
// 					read: directoriesConfig?.access?.read || collection.access.read,
// 					create: directoriesConfig?.access?.create || collection.access.create,
// 					update: directoriesConfig?.access?.update || collection.access.update,
// 					delete: directoriesConfig?.access?.delete || collection.access.delete
// 				},
// 				fields: [
// 					text('id').validate(validatePath).unique().required().hidden(),
// 					text('name').validate((value) => {
// 						const pattern = /^[a-zA-Z0-9-_ ]+$/;
// 						if (typeof value !== 'string' || !pattern.test(value)) {
// 							return 'Incorrect folder name';
// 						}
// 						return true;
// 					}),
// 					text('parent').hidden(),
// 					...(directoriesConfig?.fields || []),
// 					date('createdAt').hidden(),
// 					date('updatedAt').hidden()
// 				],
// 				type: 'collection',
// 				label: {
// 					singular: `${collection.slug} directory`,
// 					plural: `${collection.slug} directories`
// 				},
// 				icon: collection.icon,
// 				$hooks: {
// 					beforeOperation: directoriesConfig?.$hooks?.beforeOperation || [],
// 					beforeCreate: [exctractPath, ...(directoriesConfig?.$hooks?.beforeCreate || [])],
// 					beforeRead: directoriesConfig?.$hooks?.beforeRead || [],
// 					beforeUpdate: [
// 						exctractPath,
// 						prepareDirectoryChildren,
// 						...(directoriesConfig?.$hooks?.beforeUpdate || [])
// 					],
// 					beforeDelete: directoriesConfig?.$hooks?.beforeDelete || [],
// 					afterCreate: directoriesConfig?.$hooks?.afterCreate || [],
// 					afterUpdate: [updateDirectoryChildren, ...(directoriesConfig?.$hooks?.afterUpdate || [])],
// 					afterDelete: directoriesConfig?.$hooks?.afterDelete || []
// 				},
// 				asTitle: 'path',
// 				asThumbnail: collection.asThumbnail,
// 				panel: false
// 				// _generateTypes: false,
// 				// _generateSchema: false
// 			};

// 			directoriesCollection = augmentHooks(directoriesCollection);

// 			config.collections = [...(config.collections || []), directoriesCollection];
// 		}
// 	}

// 	return config;
// }

/**
 * Creates an upload directories collection for collections with upload enabled
 * Eg. for medias this will create a collection medias_directories
 */
export function makeUploadDirectoriesCollectionClient<C extends WithUpload<BuiltCollection>>(
	collection: C
) {
	const slug = withDirectoriesSuffix(collection.slug);
	const directoriesConfig = collection.upload.directories;

	console.log(collection.upload);
	console.log(directoriesConfig?.fields);

	// else create the directory collection
	let directoriesCollection: BuiltCollection = {
		slug: slug as CollectionSlug,
		kebab: withDirectoriesSuffix(collection.kebab),
		versions: undefined,
		access: {
			read: directoriesConfig?.access?.read || collection.access.read,
			create: directoriesConfig?.access?.create || collection.access.create,
			update: directoriesConfig?.access?.update || collection.access.update,
			delete: directoriesConfig?.access?.delete || collection.access.delete
		},
		fields: [
			text('id').validate(validatePath).unique().required().hidden(),
			text('name')
				.validate((value) => {
					const pattern = /^[a-zA-Z0-9-_ ]+$/;
					if (typeof value !== 'string' || !pattern.test(value)) {
						return 'Incorrect folder name';
					}
					return true;
				})
				.onChange((value, { useField }) => {
					const id = useField('id');
					const parent = useField('parent');
					const newPath = `${parent.value}:${value}`;
					id.value = newPath;
				}),
			text('parent').hidden(),
			...(directoriesConfig?.fields || []),
			date('createdAt').hidden(),
			date('updatedAt').hidden()
		],
		type: 'collection',
		label: {
			singular: `${collection.slug} directory`,
			plural: `${collection.slug} directories`
		},
		icon: collection.icon,
		asTitle: 'path',
		asThumbnail: collection.asThumbnail,
		panel: false
	};

	return directoriesCollection;
}
