import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentUrl } from '$lib/core/features/url/augment.js';
import { augmentVersions } from '$lib/core/features/versions/augment.js';
import type { AreaWithoutSlug } from '$lib/core/factory/area/types.js';
import type { Area, BuiltArea } from '$lib/core/factory/config/types.js';
import { capitalize, toKebabCase } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';
import { prototypeKebab } from '$lib/core/prototype/naming.js';

export const create = <S extends string>(
  slug: S,
  incomingConfig: AreaWithoutSlug<S>
): BuiltArea => {
  const area: Area<S> = { ...incomingConfig, slug };

  const initial = { ...area };
  const withMetas = augmentMetas(initial);
  const withVersions = augmentVersions(withMetas);
  const withUrl = augmentUrl(withVersions);
  const augmented = augmentTitle(withUrl);

  return {
    type: 'area',
    slug: augmented.slug as BuiltArea['slug'],
    kebab: prototypeKebab(augmented.slug),
    icon: augmented.icon || FileText,
    label: augmented.label ? augmented.label : capitalize(area.slug),
    fields: augmented.fields || [],
    asTitle: augmented.asTitle,
    versions: augmented.versions,
    live: incomingConfig.live || false,
    panel: incomingConfig.panel,
    access: {
      create: (user) => !!user && !!user.isStaff,
      read: (user) => !!user && !!user.isStaff,
      update: (user) => !!user && !!user.isStaff,
      delete: (user) => !!user && !!user.isStaff,
      ...augmented.access
    }
  };
};
