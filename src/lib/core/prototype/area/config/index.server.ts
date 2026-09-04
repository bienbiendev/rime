import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import { applyAugments } from '$lib/core/features/apply.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import { areaFeatures, area as prototype } from '../definition.js';
import { areaHooks } from '../hooks.server.js';
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

  // The prototype's own title fallback, which a feature may override before `title` reads it.
  const initial = { ...area, _titleFallback: prototype.titleFallback };
  // As the client chain, with the hooks step last.
  const withFeatures = applyAugments(areaFeatures, initial);
  // As the collection's factory: the two lists by name, never the server definition. See there.
  const augmented = augmentHooks(
    { features: areaFeatures as unknown as FeatureDefinition[], hooks: areaHooks },
    withFeatures
  );

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
