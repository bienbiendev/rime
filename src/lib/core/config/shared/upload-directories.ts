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
export function makeUploadDirectoriesCollectionClient<C extends WithUpload<BuiltCollection>>(
	collection: C
) {
	const slug = withDirectoriesSuffix(collection.slug);
	const directoriesConfig = collection.upload.directories;

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
