import { findTitleField } from '$lib/core/config/shared/find-title.js';
import type { CollectionAuthConfig, UploadConfig } from '$lib/core/config/types.js';
import type { Collection } from '../../../types.js';

type Input = {
	upload?: UploadConfig;
	auth?: false | CollectionAuthConfig;
	fields?: Collection<any>['fields'];
};
type WithAsTitle<T> = T & { asTitle: string };
/**
 * Set asTitle to the defined one, or fallback to
 * filename for upload, email for auth, or default to id
 */
export const augmentTitle = <T extends Input>(config: T): WithAsTitle<T> => {
	const addAsTitle = () => {
		const titleField = findTitleField(config.fields);

		switch (true) {
			case !!titleField:
				return titleField.path;
			case !!config.upload:
				return 'filename';
			case (typeof config.auth === 'boolean' && config.auth) ||
				(typeof config.auth !== 'boolean' && config.auth?.type === 'password'):
				return 'email';
			case typeof config.auth !== 'boolean' && config.auth?.type === 'apiKey':
				return 'name';
			default:
				return 'id';
		}
	};

	return {
		...config,
		asTitle: addAsTitle()
	};
};
