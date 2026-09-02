import { augmentAuthServer } from '$lib/core/features/auth/augment.server.js';
import { augmentCollectionHooks } from '$lib/core/operations/pipeline.server.js';
import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentNestedServer } from '$lib/core/features/nested/augment.server.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentUploadServer } from '$lib/core/features/upload/augment.server.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import { augmentVersions } from '$lib/core/features/versions/augment.js';
import type { CollectionWithoutSlug } from '$lib/core/factory/collection/types.js';
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
  const withUpload = augmentUploadServer(withLabel);
  const withNested = augmentNestedServer(withUpload);
  const withVersions = augmentVersions(withNested);
  // Feature augments run as one call, positioned where the run of feature augments above it
  // ends. upload, nested and versions are still hand-written here; as each converts it joins
  // this call in registry order and nothing moves, because that run is contiguous in all four
  // factories. Order matters: an augment appends fields, so moving one reorders columns.
  const withFeatures = augmentWithFeatures(withVersions, 'collection');
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
