import { augmentAuthServer } from '$lib/core/features/auth/augment.server.js';
import { augmentCollectionHooks } from '$lib/core/prototype/collection/pipeline.server.js';
import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import type { CollectionWithoutSlug } from '$lib/core/prototype/collection/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/factory/config/types.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { FileText } from '@lucide/svelte';
import { augmentLabel } from './augment-label.js';
import { augmentPanel } from './augment-panel.js';
import { augmentThumbnail } from './augment-thumbnail.js';

export const create = <S extends string>(
  slug: S,
  incomingConfig: CollectionWithoutSlug<S>
): BuiltCollection => {
  //
  const collection: Collection<S> = { ...incomingConfig, slug };
  const initial = { ...collection };
  const withLabel = augmentLabel(initial);
  // Every feature augment, in registry order — the order these calls were written in until
  // this commit. It sits where the block started, not where it ended: the registry now holds
  // upload, nested, versions and url, and each of them appends fields.
  const withFeatures = augmentWithFeatures(withLabel, 'collection');
  const withPanel = augmentPanel(withFeatures);
  const withAuth = augmentAuthServer(withPanel);
  const withMetas = augmentMetas(withAuth);
  const withHooks = augmentCollectionHooks(withMetas);
  const withTitle = augmentTitle(withHooks);
  const augmented = augmentThumbnail(withTitle);

  return {
    ...augmented,
    fields: augmented.fields || [],
    $url: augmented.$url as BuiltCollection['$url'],
    slug: augmented.slug as BuiltCollection['slug'],
    kebab: prototypeKebab(augmented.slug),
    type: 'collection',
    icon: augmented.icon || FileText,
    access: {
      create: (user) => !!user && !!user.isStaff,
      read: (user) => !!user && !!user.isStaff,
      update: (user) => !!user && !!user.isStaff,
      delete: (user) => !!user && !!user.isStaff,
      ...augmented.access
    }
  } as const;
};

export const hook = Hooks;
