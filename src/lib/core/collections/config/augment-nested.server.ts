import { number } from '$lib/fields/number/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '../../../types.js';

type IncomingConfig = { slug: string; nested?: boolean; fields?: Collection<any>['fields'] };

/**
 * Add root table fields _parent and _position
 * for nested collection
 */
export const augmentNestedServer = <T extends IncomingConfig>(config: T): T => {
	const fields = [...(config.fields || [])];

	if (config.nested) {
		const _parentField = text('_parent')
			.$generateSchema(
				() =>
					`_parent: text('_parent').references((): any => ${config.slug}.id, {onDelete: 'set null'})`
			)
			.hidden()
			._root();

		fields.push(_parentField);
		fields.push(number('_position').defaultValue(0).hidden()._root());
	}

	return { ...config, fields };
};
