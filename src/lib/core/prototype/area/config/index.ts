import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import type { AreaWithoutSlug } from '$lib/core/prototype/area/config/types.js';
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
  // Every feature augment, in registry order — the order these calls were written in until
  // this commit. It sits where the block started, not where it ended: the registry now holds
  // upload, nested, versions and url, and each of them appends fields.
  const withFeatures = augmentWithFeatures(withMetas, 'area');
  const augmented = augmentTitle(withFeatures);

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
