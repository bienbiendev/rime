import { applyAugments } from '$lib/core/features/apply.js';
import { collectionFeatures } from '../definition.js';
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
  // The collection's own augments run first, then every feature's in the order the prototype
  // listed them.
  //
  // `auth` is not called here any more: it is a feature, and it is *first* in the prototype's
  // list, which is what `title` needs — `title` resolves `asTitle` from the fallback `auth` and
  // `upload` each offer, so auth has to have run before it. Calling it here as well appended its
  // fields twice and boot rejected the config with "Duplicate field 'name' in collection 'staff'".
  const withLabel = augmentLabel(initial);
  const withPanel = augmentPanel(withLabel);
  const augmented = applyAugments(collectionFeatures, withPanel);

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
