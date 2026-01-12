import { findTitleField } from '$lib/core/config/shared/find-title.js';
import type { Area } from '../../../types.js';

type Input = {
	fields?: Area<any>['fields'];
};
type WithAsTitle<T> = T & { asTitle: string };

export const augmentTitle = <T extends Input>(config: T): WithAsTitle<T> => {
	const fieldTitle = findTitleField(config.fields);
	return {
		...config,
		asTitle: fieldTitle ? fieldTitle.path : 'id'
	};
};
