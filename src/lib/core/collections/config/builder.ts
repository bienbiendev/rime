import { augmentAuth } from '$lib/core/features/auth/augment.js';
import { augmentMetas } from '$lib/core/collections/config/augment-metas.js';
import { augmentNested } from '$lib/core/features/nested/augment.js';
import { augmentTitle } from '$lib/core/collections/config/augment-title.js';
import { augmentUpload } from '$lib/core/features/upload/augment.js';
import { augmentUrl } from '$lib/core/features/url/augment.js';
import { augmentVersions } from '$lib/core/features/versions/augment.js';
import type { CollectionWithoutSlug } from '$lib/core/collections/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/config/types.js';
import { access } from '$lib/util/index.js';
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
  const withUpload = augmentUpload(withLabel);
  const withNested = augmentNested(withUpload);
  const withVersions = augmentVersions(withNested);
  const withUrl = augmentUrl(withVersions);
  const withAuth = augmentAuth(withUrl);
  const withMetas = augmentMetas(withAuth);
  const withTitle = augmentTitle(withMetas);
  const withPanel = augmentPanel(withTitle);
  const augmented = augmentThumbnail(withPanel);

  return {
    type: 'collection',
    slug: augmented.slug as BuiltCollection['slug'],
    kebab: toKebabCase(augmented.slug),
    label: augmented.label,
    auth: augmented.auth,
    nested: augmented.nested,
    upload: augmented.upload,
    fields: augmented.fields || [],
    asTitle: augmented.asTitle,
    asThumbnail: augmented.asThumbnail,
    versions: augmented.versions,
    icon: augmented.icon || FileText,
    live: incomingConfig.live || false,
    panel: incomingConfig.panel,
    access: {
      create: (user) => access.isStaff(user),
      read: (user) => access.isStaff(user),
      update: (user) => access.isStaff(user),
      delete: (user) => access.isStaff(user),
      ...(incomingConfig.access || {})
    }
  };
};
