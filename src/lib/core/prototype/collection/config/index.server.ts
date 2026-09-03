import { augmentAuthServer } from '$lib/core/features/auth/augment.server.js';
import { augmentCollectionHooks } from '$lib/core/prototype/collection/pipeline.server.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import type { CollectionWithoutSlug } from '$lib/core/prototype/collection/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/factory/config/types.js';
import { Hooks } from '$lib/core/factory/hooks.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { FileText } from '@lucide/svelte';
import { augmentLabel } from './augment-label.js';
import { augmentPanel } from './augment-panel.js';

export const create = <S extends string>(
  slug: S,
  incomingConfig: CollectionWithoutSlug<S>
): BuiltCollection => {
  //
  const collection: Collection<S> = { ...incomingConfig, slug };
  const initial = { ...collection };
  // Same shape as the client chain: the collection's own augments, then every feature's. The
  // hooks step stays at the end, after the features that contribute to the pipeline have been
  // applied to the config it reads.
  const withLabel = augmentLabel(initial);
  const withAuth = augmentAuthServer(withLabel);
  const withPanel = augmentPanel(withAuth);
  const withFeatures = augmentWithFeatures(withPanel, 'collection');
  const augmented = augmentCollectionHooks(withFeatures);

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
