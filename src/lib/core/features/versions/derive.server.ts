import { augmentHooks } from '$lib/core/pipeline/build-pipeline.server.js';
import type { RegisteredPrototype } from '$lib/core/prototype/define.js';
import { collectionHooks } from '$lib/core/prototype/collection/hooks.server.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { CollectionSlug } from '$lib/core/prototype/types.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import type { BuiltCollection, Config } from '../../config/types.js';

/**
 * The shadow holds the content half of a document, so it carries the content half of the fields:
 * everything except what the base row keeps (`._root()`). The schema generator splits the two
 * tables by the same flag, so a shadow config claiming a base field would name a column its table
 * does not have.
 */
const contentFields = (config: { fields: BuiltCollection['fields'] }) =>
  config.fields.filter((field) => !field.get.root);

/**
 * Derives the shadow collection behind every versioned config — `$pages__versions` for a versioned
 * `pages`, and one per versioned area, which is a collection because a single document still has
 * many revisions.
 */
export function makeVersionsCollectionsAliases<C extends Config>(
  config: C,
  prototypes: RegisteredPrototype[] = []
) {
  // The collection prototype's features, from the registry the caller hands over rather than from
  // importing its definition — see FeatureDefinition.configure.
  const features = prototypes.find((prototype) => prototype.name === 'collection')?.features || [];

  /**
   * A shadow is a collection, so it gets a collection's pipeline: the prototype's own hooks, the
   * features **its own** config enables, and the author's hooks.
   *
   * Not the parent's `$hooks`, which is a pipeline already resolved for the parent's features. A
   * versioned + nested collection put `addChildrenProperty` on its shadow that way, and the shadow
   * has no `_parent` column for it to query; a versioned area put every core step on twice.
   */
  const withPipeline = (shadow: BuiltCollection) =>
    augmentHooks({ features, hooks: collectionHooks }, shadow);

  for (const collection of config.collections || []) {
    if (collection.versions) {
      const versionedCollection: BuiltCollection = {
        slug: withVersionsSuffix(collection.slug) as CollectionSlug,
        kebab: prototypeKebab(withVersionsSuffix(collection.slug)),
        versions: undefined,
        access: collection.access,
        $hooks: collection._authorHooks,
        fields: contentFields(collection),
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
      config.collections = [...(config.collections || []), withPipeline(versionedCollection)];
    }
  }

  for (const area of config.areas || []) {
    if (area.versions) {
      const versionedCollection: BuiltCollection = {
        slug: withVersionsSuffix(area.slug) as CollectionSlug,
        kebab: prototypeKebab(withVersionsSuffix(area.slug)),
        icon: area.icon,
        versions: undefined,
        access: area.access,
        asTitle: area.asTitle,
        asThumbnail: null,
        $hooks: area._authorHooks,
        fields: contentFields(area),
        type: 'collection',
        label: { plural: area.label, singular: area.label },
        panel: false,
        _generateTypes: false,
        _generateSchema: false
      } as const;

      config.collections = [...(config.collections || []), withPipeline(versionedCollection)];
    }
  }

  return config;
}
