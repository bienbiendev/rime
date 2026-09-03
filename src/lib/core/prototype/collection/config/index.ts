import { augmentAuth } from '$lib/core/features/auth/augment.js';
import { augmentWithFeatures } from '$lib/core/features/registry.js';
import type { CollectionWithoutSlug } from '$lib/core/prototype/collection/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/factory/config/types.js';
import { access } from '$lib/util/index.js';
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
  // The collection's own augments run first, then every feature's in registry order.
  //
  // That ordering is now load-bearing rather than incidental: `title` resolves `asTitle` from the
  // fallback `auth` and `upload` each offer, so auth has to have run before the feature block.
  // It also moves auth's and metas' fields relative to the feature fields — see the commit
  // message; the column order changes and a migration comes with it.
  const withLabel = augmentLabel(initial);
  const withAuth = augmentAuth(withLabel);
  const withPanel = augmentPanel(withAuth);
  const augmented = augmentWithFeatures(withPanel, 'collection');

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
