import type { AreaWithoutSlug } from '$lib/core/factory/area/types.js';
import type { Area, BuiltArea } from '$lib/core/factory/config/types.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import { augmentAreaHooks } from '$lib/core/operations/pipeline.server.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { capitalize } from '$lib/util/string.js';
import { FileText } from '@lucide/svelte';

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
  const withTitle = augmentTitle(withFeatures);
  const augmented = augmentAreaHooks(withTitle);

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
