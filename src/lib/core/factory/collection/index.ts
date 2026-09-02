import { augmentAuth } from '$lib/core/features/auth/augment.js';
import { augmentMetas } from '$lib/core/factory/shared/augment-metas.js';
import { augmentTitle } from '$lib/core/factory/shared/augment-title.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import type { CollectionWithoutSlug } from '$lib/core/factory/collection/types.js';
import type { BuiltCollection, Collection } from '$lib/core/factory/config/types.js';
import { access } from '$lib/util/index.js';
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
  const withAuth = augmentAuth(withFeatures);
  const withMetas = augmentMetas(withAuth);
  const withTitle = augmentTitle(withMetas);
  const withPanel = augmentPanel(withTitle);
  const augmented = augmentThumbnail(withPanel);

  return {
    type: 'collection',
    slug: augmented.slug as BuiltCollection['slug'],
    kebab: prototypeKebab(augmented.slug),
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
