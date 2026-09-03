import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import { area as areaPrototype } from '../definition.server.js';
import { applyAugments } from '$lib/core/features/apply.js';
import { areaFeatures } from '../definition.js';
import type { AreaWithoutSlug } from '$lib/core/prototype/area/config/types.js';
import type { Area, BuiltArea } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
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
  const withFeatures = applyAugments(areaFeatures, initial);
  const augmented = augmentHooks(areaPrototype, withFeatures);

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
