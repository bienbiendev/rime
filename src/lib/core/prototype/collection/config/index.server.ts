import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import { applyAugments } from '$lib/core/features/apply.js';
import type { FeatureDefinition } from '$lib/core/features/define.js';
import { collectionFeatures } from '../definition.js';
import { collectionHooks } from '../hooks.server.js';
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
  const initial = { ...collection };
  // Same shape as the client chain: the collection's own augments, then every feature's, and no
  // separate `augmentAuth` — auth is a feature, listed first. The hooks step stays at the end,
  // after the features that contribute to the pipeline have been applied to the config it reads.
  const withLabel = augmentLabel(initial);
  const withPanel = augmentPanel(withLabel);
  const withFeatures = applyAugments(collectionFeatures, withPanel);
  // The two lists by name, never the server definition: that file spreads `{ ...base }` at module
  // scope, so importing it from here makes this factory depend on an evaluation order — and when
  // that order changed, the spread came out without `features` and every feature hook silently
  // stopped running (rule 3). `definition.ts` and `hooks.server.ts` both depend on nothing.
  const augmented = augmentHooks(
    { features: collectionFeatures as unknown as FeatureDefinition[], hooks: collectionHooks },
    withFeatures
  );

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
