import { getValueAtPath, isObjectLiteral } from '$lib/util/object.js';
import { richTextJSONToText } from 'rimecms/fields/rich-text';
import { Hooks } from '../index.server.js';

export const setDocumentTitle = Hooks.beforeRead<'raw'>(async (args) => {
	const config = args.config;
	let doc = args.doc;

	const paramSelect = args.context.params.select;
	const hasSelect = Array.isArray(paramSelect) && paramSelect.length;
	const shouldSetTitle = !doc.title && (!hasSelect || (hasSelect && paramSelect.includes('title')));

	if (shouldSetTitle) {
		function computeTitleFromValue(value: unknown): string {
			// Handle rich text value
			if (isObjectLiteral(value) && 'content' in value) {
				return richTextJSONToText(value as any);
			}
			if (typeof value === 'string') {
				return value;
			}
			return doc.id;
		}

		const titleRaw = getValueAtPath(config.asTitle, doc);
		const title = computeTitleFromValue(titleRaw);

		doc = {
			title,
			...doc
		};
	}

	return { ...args, doc };
});
