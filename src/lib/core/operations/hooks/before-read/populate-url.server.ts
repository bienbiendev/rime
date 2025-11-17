import { logger } from '$lib/core/logger/index.server.js';
import { getValueAtPath } from '$lib/util/object.js';
import { Hooks } from '../index.server.js';

/**
 * Hook to populate _children property on document from a nested collection
 */
export const populateURL = Hooks.beforeRead<'generic'>(async (args) => {
	const select =
		args.context.params.select && Array.isArray(args.context.params.select)
			? args.context.params.select
			: [];
	const HAS_SELECT = select.length > 0;

	// If there is a select param, populate url only if included
	if (HAS_SELECT) return args;

	// Else populate url
	const { config, event, context } = args;
	const locale = context.params.locale;
	const document = args.doc;

	if (config.$url) {
		let url;

		try {
			url = config.$url(document);
		} catch (err: any) {
			logger.error(
				`Error while generating url of ${config.slug} with id: ${args.doc.id}, ${err.message}`
			);
			return args;
		}

		const match = url.match(/\[\.\.\.parent\.(\w+(?:\.\w+)*)\]/);

		if (match) {
			const fullMatch = match[0];
			const attributePath = match[1];

			// Create array to store parent attributes
			const attributesArray: string[] = [];

			const MAX_DEPTH = 6;
			let depth = 0;

			let parent = document._parent;

			while (parent && depth < MAX_DEPTH) {
				depth++;

				const docs = await event.locals.rime.collection(config.slug as any).find({
					query: `where[id][equals]=${parent}`,
					select: [attributePath, '_parent'],
					locale
				});

				// Check if there is a result
				if (docs && docs.length > 0) {
					const parentDoc = docs[0];
					const parentAttribute = getValueAtPath(attributePath, parentDoc);

					if (parentAttribute && typeof parentAttribute === 'string') {
						attributesArray.push(parentAttribute);
					} else if (parentAttribute) {
						logger.warn('Bad URL property: not a string', { attributePath, parentAttribute });
					}

					// Move up to the next parent
					parent = parentDoc._parent;
				} else {
					parent = null;
				}
			}

			if (attributesArray.length) {
				// Replace the parent reference with the joined attributes
				url = url.replace(fullMatch, attributesArray.reverse().join('/'));
			} else {
				url = url.replace('/' + fullMatch, '');
			}
		} else {
			// replace "/[...parent.whatever.something.foo]" with ""
			url = url.replace(/\/\[\.\.\.parent\.\w+(?:\.\w+)*\]/, '');
		}

		if (!url) {
			return args;
		}
		if (url.includes('undefined')) {
			logger.warn('Missing document properties to generate URL for : ' + document.id);
			return args;
		}

		// Add the url if successfully generated
		if (url) {
			if (args.doc.url !== url) {
				args.event.locals.rime.adapter.updateDocumentUrl(url, {
					id: args.doc.id,
					versionId: args.doc.versionId,
					config,
					locale
				});
			}
			args.doc = { ...args.doc, url };
		}

		// Add the live url if needed
		if (config.live && event.locals.user && url) {
			args.doc._live = `${process.env.PUBLIC_RIME_URL}/live?src=${url}&slug=${config.slug}&id=${args.doc.id}`;
			args.doc._live += locale ? `&locale=${locale}` : '';
		}
	}

	return args;
});
