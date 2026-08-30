import { augmentAuthServer } from '$lib/core/features/auth/augment.server.js';
import { augmentCollectionHooks } from '$lib/core/operations/pipeline.server.js';
import { augmentMetas } from '$lib/core/collections/config/augment-metas.js';
import { augmentNestedServer } from '$lib/core/features/nested/augment.server.js';
import { augmentTitle } from '$lib/core/collections/config/augment-title.js';
import { augmentUploadServer } from '$lib/core/features/upload/augment.server.js';
import { augmentUrl } from '$lib/core/features/url/augment.js';
import { augmentVersions } from '$lib/core/features/versions/augment.js';
import type { CollectionWithoutSlug } from '$lib/core/collections/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/operations/hooks.js';
import { toKebabCase } from '$lib/util/string.js';
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
  const withUrl = augmentUrl(withVersions);
  const withPanel = augmentPanel(withUrl);
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
    kebab: toKebabCase(augmented.slug),
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
