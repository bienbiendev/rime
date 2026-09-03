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
  // An area declares no augments of its own — metas and title, which used to bracket the feature
  // block here, are features now. Everything it gets, it gets from the registry.
  const augmented = augmentWithFeatures(initial, 'area');

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
