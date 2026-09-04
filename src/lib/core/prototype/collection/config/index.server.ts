import { applyAugments } from '$lib/core/features/apply.js';
import { collectionFeatures, collection as prototype } from '../definition.js';
import type { CollectionWithoutSlug } from '$lib/core/prototype/collection/config/types.js';
import type { BuiltCollection, Collection } from '$lib/core/config/types.js';
import { Hooks } from '$lib/core/pipeline/hooks.js';
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
  // The prototype's own title fallback, which a feature may override before `title` reads it.
  const initial = { ...collection, _titleFallback: prototype.titleFallback };
  // Same shape as the client chain: the collection's own augments, then every feature's.
  //
  // No hooks step here. A config's pipeline is resolved once the *whole* config exists — see
  // prototype/pipelines.server.ts — so that a collection derived by a feature is resolved by the
  // same line as this one, and `$hooks` stays what the author wrote until then.
  const withLabel = augmentLabel(initial);
  const withPanel = augmentPanel(withLabel);
  const withFeatures = applyAugments(collectionFeatures, withPanel);

  return {
    ...withFeatures,
    fields: withFeatures.fields || [],
    $url: withFeatures.$url as BuiltCollection['$url'],
    slug: withFeatures.slug as BuiltCollection['slug'],
    kebab: prototypeKebab(withFeatures.slug),
    type: 'collection',
    icon: withFeatures.icon || FileText,
    access: {
      create: (user) => !!user && !!user.isStaff,
      read: (user) => !!user && !!user.isStaff,
      update: (user) => !!user && !!user.isStaff,
      delete: (user) => !!user && !!user.isStaff,
      ...withFeatures.access
    }
  } as const;
};

export const hook = Hooks;
