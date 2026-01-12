import { findThumbnailField } from '$lib/core/config/shared/find-thumbnail.js';
import type { CollectionAuthConfig, UploadConfig } from '$lib/core/config/types.js';
import type { Collection } from '../../../types.js';

type Input = {
	upload?: UploadConfig;
	auth?: false | CollectionAuthConfig;
	fields?: Collection<any>['fields'];
};
type WithAsThumbnail<T> = T & { asThumbnail: string | null };
/**
 * Set asThumbnail to the defined one, or fallback to
 * filename for upload, email for auth, or default to id
 */
export const augmentThumbnail = <T extends Input>(config: T): WithAsThumbnail<T> => {
	const addAsThumbnail = () => {
		const thumbnailField = findThumbnailField(config.fields);
		return thumbnailField?.path || null;
	};

	return {
		...config,
		asThumbnail: addAsThumbnail()
	};
};
