import { augmentAuthServer } from '$lib/core/collections/config/augment-auth.server.js';
import { augmentHooks } from '$lib/core/collections/config/augment-hooks.server.js';
import { augmentMetas } from '$lib/core/collections/config/augment-metas.js';
import { augmentNestedServer } from '$lib/core/collections/config/augment-nested.server.js';
import { augmentTitle } from '$lib/core/collections/config/augment-title.js';
import { augmentUploadServer } from '$lib/core/collections/config/augment-upload.server.js';
import { augmentUrl } from '$lib/core/collections/config/augment-url.js';
import { augmentVersions } from '$lib/core/collections/config/augment-versions.js';
import type { CollectionWithoutSlug } from '$lib/core/collections/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { toKebabCase } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';
import { augmentLabel } from './augment-label.js';
import { augmentThumbnail } from './augment-thumbnail.js';

export const create = <S extends string>(
	slug: S,
	incomingConfig: CollectionWithoutSlug<S>
): BuiltCollection => {
	//
	const collection: Collection<S> = { ...incomingConfig, slug };
	const initial = { ...collection };
	const withLabel = augmentLabel(initial);
	const withUpload = augmentUploadServer(withLabel);
	const withNested = augmentNestedServer(withUpload);
	const withVersions = augmentVersions(withNested);
	const withUrl = augmentUrl(withVersions);
	const withAuth = augmentAuthServer(withUrl);
	const withMetas = augmentMetas(withAuth);
	const withHooks = augmentHooks(withMetas);
	const withTitle = augmentTitle(withHooks);
	const augmented = augmentThumbnail(withTitle);

	return {
		...augmented,
		fields: augmented.fields || [],
		$url: augmented.$url as BuiltCollection['$url'],
		slug: augmented.slug as BuiltCollection['slug'],
		kebab: toKebabCase(augmented.slug),
		type: 'collection',
		icon: augmented.icon || FileText,
		access: {
			create: (user) => !!user && !!user.isStaff,
			read: (user) => !!user && !!user.isStaff,
			update: (user) => !!user && !!user.isStaff,
			delete: (user) => !!user && !!user.isStaff,
			...augmented.access
		}
	} as const;
};

export const hook = Hooks;
