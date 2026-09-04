import { applyAugments } from '$lib/core/features/apply.js';
import { areaFeatures, area as prototype } from '../definition.js';
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
  // As the client chain. The pipeline is resolved once the whole config exists — see
  // prototype/pipelines.server.ts.
  const withFeatures = applyAugments(areaFeatures, initial);

  return {
    ...withFeatures,
    type: 'area',
    fields: withFeatures.fields || [],
    slug: withFeatures.slug as BuiltArea['slug'],
    kebab: prototypeKebab(withFeatures.slug),
    $url: withFeatures.$url as BuiltArea['$url'],
    icon: withFeatures.icon || FileText,
    label: withFeatures.label ? withFeatures.label : capitalize(area.slug),
    access: {
      create: (user) => !!user && !!user.isStaff,
      read: (user) => !!user && !!user.isStaff,
      update: (user) => !!user && !!user.isStaff,
      delete: (user) => !!user && !!user.isStaff,
      ...withFeatures.access
    }
  };
};

export const hook = Hooks;
