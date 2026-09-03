import type { AreaWithoutSlug } from '$lib/core/prototype/area/config/types.js';
import type { Area, BuiltArea } from '$lib/core/factory/config/types.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import { augmentAreaHooks } from '$lib/core/prototype/area/pipeline.server.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { capitalize } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';

export const create = <S extends string>(
  slug: S,
  incomingConfig: AreaWithoutSlug<S>
): BuiltArea => {
  const area: Area<S> = { ...incomingConfig, slug };

  const initial = { ...area };
  // As the client chain, with the hooks step last.
  const withFeatures = augmentWithFeatures(initial, 'area');
  const augmented = augmentAreaHooks(withFeatures);

  return {
    ...augmented,
    type: 'area',
    fields: augmented.fields || [],
    slug: augmented.slug as BuiltArea['slug'],
    kebab: prototypeKebab(augmented.slug),
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
