import { applyAugments } from '$lib/core/features/apply.js';
import { areaFeatures, area as prototype } from '../definition.js';
import type { AreaWithoutSlug } from '$lib/core/prototype/area/config/types.js';
import type { Area, BuiltArea } from '$lib/core/config/types.js';
import { capitalize } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';
import { prototypeKebab } from '$lib/core/prototype/naming.js';

export const create = <S extends string>(
  slug: S,
  incomingConfig: AreaWithoutSlug<S>
): BuiltArea => {
  const area: Area<S> = { ...incomingConfig, slug };

  // The prototype's own title fallback, which a feature may override before `title` reads it.
  const initial = { ...area, _titleFallback: prototype.titleFallback };
  // An area declares no augments of its own: everything it gets, it gets from its feature list.
  const augmented = applyAugments(areaFeatures, initial);

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
