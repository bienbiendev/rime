import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import type { BuiltCollection, Config } from '../../config/types.js';

/**
 * Creates versioned collection aliases for collections and areas with versioning enabled
 *
 * @example
 * // If a collection "pages" has versions enabled, this will create a "pages_versions" collection
 * // if an area "settings" has versions enabled, this will create also a "settings_versions" collection
 * const updatedConfig = makeVersionsCollectionsAliases(config);
 */
export function makeVersionsCollectionsAliases<C extends Config>(
  config: C,
  prototypes: RegisteredPrototype[] = []
) {
  for (const collection of config.collections || []) {
    if (collection.versions) {
      const versionedCollection: BuiltCollection = {
        slug: withVersionsSuffix(collection.slug) as CollectionSlug,
        kebab: prototypeKebab(withVersionsSuffix(collection.slug)),
        versions: undefined,
        access: collection.access,
        $hooks: collection.$hooks,
        fields: collection.fields,
        auth: collection.auth,
        upload: collection.upload,
        label: collection.label,
        type: collection.type,
        asTitle: collection.asTitle,
        asThumbnail: collection.asThumbnail,
        icon: collection.icon,
        panel: false,
        _generateTypes: false,
        _generateSchema: false
      } as const;
      config.collections = [...(config.collections || []), versionedCollection];
    }
  }

  for (const area of config.areas || []) {
    if (area.versions) {
      let versionedCollection: BuiltCollection = {
        slug: withVersionsSuffix(area.slug) as CollectionSlug,
        kebab: prototypeKebab(withVersionsSuffix(area.slug)),
        icon: area.icon,
        versions: undefined,
        access: area.access,
        asTitle: area.asTitle,
        asThumbnail: null,
        $hooks: area.$hooks,
        fields: area.fields,
        type: 'collection',
        label: { plural: area.label, singular: area.label },
        panel: false,
        _generateTypes: false,
        _generateSchema: false
      } as const;

      // As upload's derived directories collection: the prototype's own hooks plus the features
      // its definition lists. The features come from the registry the caller hands over, never
      // from importing the definition — this module is reached *from* that definition now that it
      // is the versions feature's `configure`, and importing it back leaves whichever feature is
      // still in flight `undefined` in the definition's own list. See FeatureDefinition.configure.
      const features = prototypes.find((prototype) => prototype.name === 'collection')?.features;
      versionedCollection = augmentHooks(
        { features: features || [], hooks: collectionHooks },
        versionedCollection
      );

      config.collections = [...(config.collections || []), versionedCollection];
    }
  }

  return config;
}
