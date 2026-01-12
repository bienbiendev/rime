import { augmentHooks } from '$lib/core/areas/config/augment-hooks.server.js';
import { augmentMetas } from '$lib/core/areas/config/augment-metas.js';
import { augmentTitle } from '$lib/core/areas/config/augment-title.js';
import { augmentUrl } from '$lib/core/areas/config/augment-url.js';
import { augmentVersions } from '$lib/core/areas/config/augment-versions.js';
import type { AreaWithoutSlug } from '$lib/core/areas/config/types.js';
import type { Area, BuiltArea } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { capitalize, toKebabCase } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';

export const create = <S extends string>(
	slug: S,
	incomingConfig: AreaWithoutSlug<S>
): BuiltArea => {
	const area: Area<S> = { ...incomingConfig, slug };

	const initial = { ...area };
	const withMetas = augmentMetas(initial);
	const withVersions = augmentVersions(withMetas);
	const withUrl = augmentUrl(withVersions);
	const withTitle = augmentTitle(withUrl);
	const augmented = augmentHooks(withTitle);

	return {
		...augmented,
		type: 'area',
		fields: augmented.fields || [],
		slug: augmented.slug as BuiltArea['slug'],
		kebab: toKebabCase(augmented.slug),
		$url: augmented.$url as BuiltArea['$url'],
		icon: augmented.icon || FileText,
		label: augmented.label ? augmented.label : capitalize(area.slug),
		access: {
			create: (user) => !!user && !!user.isStaff,
			read: (user) => !!user && !!user.isStaff,
			update: (user) => !!user && !!user.isStaff,
			delete: (user) => !!user && !!user.isStaff,
			...augmented.access
		}
	};
};

export const hook = Hooks;
