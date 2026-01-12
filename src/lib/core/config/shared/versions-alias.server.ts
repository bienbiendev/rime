import { augmentHooks } from '$lib/core/collections/config/augment-hooks.server.js';
import { withVersionsSuffix } from '$lib/core/naming.js';
import type { CollectionSlug } from '$lib/core/types/doc.js';
import { toKebabCase } from '$lib/util/string.js';
import type { BuiltCollection, Config } from '../types.js';

/**
 * Creates versioned collection aliases for collections and areas with versioning enabled
 *
 * @example
 * // If a collection "pages" has versions enabled, this will create a "pages_versions" collection
 * // if an area "settings" has versions enabled, this will create also a "settings_versions" collection
 * const updatedConfig = makeVersionsCollectionsAliases(config);
 */
export function makeVersionsCollectionsAliases<C extends Config>(config: C) {
	for (const collection of config.collections || []) {
		if (collection.versions) {
			const versionedCollection: BuiltCollection = {
				slug: withVersionsSuffix(collection.slug) as CollectionSlug,
				kebab: withVersionsSuffix(toKebabCase(collection.slug)),
				versions: undefined,
				access: collection.access,
				$hooks: collection.$hooks,
				fields: collection.fields,
				auth: collection.auth,
				upload: collection.upload,
				label: collection.label,
				type: collection.type,
				asTitle: collection.asTitle,
				asThumbnail: collection.asThumbnail,
				icon: collection.icon,
				panel: false,
				_generateTypes: false,
				_generateSchema: false
			} as const;
			config.collections = [...(config.collections || []), versionedCollection];
		}
	}

	for (const area of config.areas || []) {
		if (area.versions) {
			let versionedCollection: BuiltCollection = {
				slug: withVersionsSuffix(area.slug) as CollectionSlug,
				kebab: withVersionsSuffix(toKebabCase(area.slug)),
				icon: area.icon,
				versions: undefined,
				access: area.access,
				asTitle: area.asTitle,
				asThumbnail: null,
				$hooks: area.$hooks,
				fields: area.fields,
				type: 'collection',
				label: { plural: area.label, singular: area.label },
				panel: false,
				_generateTypes: false,
				_generateSchema: false
			} as const;

			versionedCollection = augmentHooks(versionedCollection);

			config.collections = [...(config.collections || []), versionedCollection];
		}
	}

	return config;
}
