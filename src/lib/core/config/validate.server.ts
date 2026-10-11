import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import type { BuildConfig } from '#lib/core/config/build.server.js';
import { validateAuth } from '#lib/core/auth/validate-config.js';
import { validateVersions } from '#lib/core/prototype/shared/versions/validate-config.server.js';
import { validateUploads } from '#lib/core/prototype/collection/upload/validate-config.server.js';
import cache from '#lib/core/dev/cache.server.js';
import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import {
  PickManyFieldBuilder,
  PickOneFieldBuilder
} from '#lib/core/fields/builders/select-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { logger } from '#lib/core/logger.server.js';
import type { PrototypeSlug } from '#lib/core/prototype/types.js';
import { BlocksBuilder, type BlocksField } from '#lib/fields/blocks/index.js';
import { RelationFieldBuilder } from '#lib/fields/relation/index.js';
import { TabsBuilder } from '#lib/fields/tabs/index.js';
import { prototypeKebab } from '#lib/core/prototype/naming.js';
import { isCamelCase } from '#lib/util/string.js';

/** A field name: letters, digits and `_`, a letter first after any `_`: `_hello_guys`, `fooBar` */
const FIELD_NAME = /^_*[a-zA-Z][a-zA-Z0-9_]*$/;

function hasDuplicates(arr: string[]): string[] {
  return [...new Set(arr.filter((e, i, a) => a.indexOf(e) !== i))];
}

/**
 * Check if there are multiple occurences
 * of the same slug inside collections and areas
 */
function hasDuplicateSlug(config: BuildConfig) {
  const slugs: PrototypeSlug[] = [];
  for (const collection of config.collections) {
    slugs.push(collection.slug);
  }
  for (const area of config.areas) {
    slugs.push(area.slug);
  }

  const duplicates = hasDuplicates(slugs);
  if (duplicates.length) {
    return ['Duplicated collection/area slugs :' + duplicates.join(', ')];
  }
  return [];
}

/**
 * Check that all area/collection slugs are camelCase
 */
function validateSlugs(config: BuildConfig) {
  const errors: string[] = [];
  const slugs: string[] = [
    ...config.collections.map((c) => c.slug),
    ...config.areas.map((a) => a.slug)
  ];

  for (const slug of slugs) {
    // `$` marks a slug rime derived itself ($pages__versions, $mediasDirectories): camelCase parts
    // joined by `__`. Checked by that shape rather than by suffix, so core never has to know what
    // a feature appends.
    if (slug.startsWith('$')) {
      if (!slug.slice(1).split('__').every(isCamelCase)) {
        errors.push(`Slug ${slug} is not a valid derived slug`);
      }
      continue;
    }

    if (slug.includes('__')) {
      errors.push(
        `Slug ${slug} may not contain "__": it marks a derived table (pages__versions), and a slug containing it would collide with one.`
      );
      continue;
    }
    if (!isCamelCase(slug)) {
      errors.push(`Slug ${slug} is not a valid prototype slug, it must be camelCase`);
    }
  }

  return errors;
}

/**
 * Validate documents fields for each collections
 * and areas
 */
const validateFields = (config: BuildConfig) => {
  let errors: string[] = [];
  for (const collection of config.collections) {
    const collectionErrors = validateDocumentFields(collection, config);
    errors = [...errors, ...collectionErrors];
  }
  for (const area of config.areas) {
    const collectionErrors = validateDocumentFields(area, config);
    errors = [...errors, ...collectionErrors];
  }
  return errors;
};

const validateDocumentFields = (
  documentConfig: BuiltCollection | BuiltArea,
  config: BuildConfig
) => {
  const errors: string[] = [];
  const registeredBlocks: Record<string, BlocksField['blocks'][number]> = {};

  const validateRelationField = (field: RelationFieldBuilder) => {
    const collectionsSlugs = config.collections.map((c) => c.slug);
    if (!collectionsSlugs.includes(field.get.relationTo)) {
      errors.push(
        `Relation field ${field.name} references unknown collection ${field.get.relationTo}, in ${documentConfig.type} ${documentConfig.slug}`
      );
    }

    // A relation is junction rows, and the base row has no junction. A reference that must sit
    // there is a text column with `$references(slug, { resolve: true })`.
    if (field.get.root) {
      errors.push(
        `Relation field ${field.name} can't be $root(), in ${documentConfig.type} ${documentConfig.slug}`
      );
    }
  };

  /** The names this level writes under: each form field's, and each tab's. */
  const namesAtLevel = (fields: FieldBuilder[]) =>
    fields.flatMap((field) => {
      if (field instanceof TabsBuilder) return field.get.tabs.map((tab) => tab.name);
      return isFormField(field) ? [field.name] : [];
    });

  const validateFields = (fields: FieldBuilder[]) => {
    for (const duplicate of hasDuplicates(namesAtLevel(fields))) {
      errors.push(
        `Duplicate field or tab '${duplicate}' in ${documentConfig.type} '${documentConfig.slug}'`
      );
    }

    for (const field of fields) {
      if (isFormField(field)) {
        // A `$root()` field sits on the base row, which has no locales branch.
        if (field.get.root && field.get.localized) {
          errors.push(
            `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} with $root(), can't be localized`
          );
        }

        // A resolved reference is joined from a column of the row; a localized column is on the
        // locales branch, where no join reaches it.
        if (field._references?.resolve && field.get.localized) {
          errors.push(
            `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} with a resolved reference, can't be localized`
          );
        }

        // Check for malformed field.name
        if (!FIELD_NAME.test(field.name)) {
          errors.push(
            `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} should be camelCase`
          );
        }

        // A blocks rule, not a walk: it compares whole block builders, which a node does not carry.
        if (field instanceof BlocksBuilder) {
          for (const block of field.get.blocks) {
            // A "." splits the path segment that carries the block name
            if (block.name.includes('.')) {
              errors.push(
                `Block ${block.name} of ${documentConfig.type} ${documentConfig.slug} can't hold a "."`
              );
            }
            if (block.name in registeredBlocks) {
              const blockDefinedButDiffer =
                JSON.stringify(registeredBlocks[block.name]) !== JSON.stringify(block);
              if (blockDefinedButDiffer) {
                errors.push(`Each block with same name should be identique (block ${block.name})`);
              }
            } else {
              registeredBlocks[block.name] = block;
            }
          }
          // A default names block types this list declares. A function default is checked when
          // it runs.
          const initial = field.get.defaultValue;
          if (Array.isArray(initial)) {
            try {
              field.use.completeDefault(initial);
            } catch (error) {
              errors.push(
                `${(error as Error).message}, in ${documentConfig.type} ${documentConfig.slug}`
              );
            }
          }
        } else if (field instanceof RelationFieldBuilder) {
          validateRelationField(field);
        } else if (
          (field instanceof PickOneFieldBuilder || field instanceof PickManyFieldBuilder) &&
          !field.get.options?.length
        ) {
          errors.push(
            `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} should have at least one option`
          );
        }
      }

      // Every block type, every tab, a group's and a tree row's fields: one level each.
      for (const node of field.use.nodes()) {
        validateFields(node.fields);
      }
    }
  };

  validateFields(documentConfig.fields);

  return errors;
};

const hasDatabase = (config: BuildConfig) => {
  const hasDatabaseName = '$adapter' in config;
  if (!hasDatabaseName) {
    return ['config.$adapter not defined'];
  }
  return [];
};

/**
 * What each feature requires of a config that declares it. Every rule set guards its own
 * not-declared case, so this only says which kinds of config each one is asked of.
 *
 * ```
 * validateAuth       core/auth/validate-config.ts                        collections
 * validateVersions   core/prototype/shared/versions/validate-config.server.ts   collections and areas
 * validateUploads    core/prototype/collection/upload/validate-config.server.ts  the collections together
 * ```
 */
function validateFeatures(config: BuildConfig) {
  const { collections, areas } = config;

  return [
    ...collections.flatMap((c) => validateAuth(c)),
    ...[...collections, ...areas].flatMap((c) => validateVersions(c)),
    ...validateUploads(collections)
  ];
}

/**
 * Every prototype's `kebab` must actually be kebab.
 *
 * It is what the generated param matchers and every REST/panel URL are built from, so a slug
 * leaking into it produces routes like `/api/$mediasDirectories` — and a 404, since the matcher
 * and the link disagree with the config. A wrong kebab is not a type error and does not show up
 * until a request is made, so it is checked here where codegen already runs.
 */
function validateKebabs(config: BuildConfig) {
  const errors: string[] = [];
  const prototypes = [...config.collections, ...config.areas];

  for (const prototype of prototypes) {
    const expected = prototypeKebab(prototype.slug);
    if (prototype.kebab !== expected) {
      errors.push(
        `Prototype ${prototype.slug} has kebab "${prototype.kebab}", expected "${expected}" — build it with prototypeKebab().`
      );
    }
  }

  return errors;
}

function validate(config: BuildConfig): boolean {
  const validateFunctions = [
    hasDuplicateSlug,
    validateSlugs,
    validateKebabs,
    validateFields,
    validateFeatures,
    hasDatabase
  ];

  for (const isValid of validateFunctions) {
    const errors: string[] = isValid(config);
    if (errors.length) {
      cache.clear();
      errors.map((err) => logger.error(err));
      return false;
    }
  }

  logger.debug('Config is valid');
  return true;
}

export default validate;
