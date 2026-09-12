import type { BuiltArea, BuiltCollection, Config } from '$lib/core/config/types.js';
import { validateAuth } from '$lib/core/auth/validate-config.js';
import { validateVersions } from '$lib/core/prototype/shared/versions/validate-config.server.js';
import cache from '$lib/core/dev/cache.server.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import { logger } from '$lib/core/logger.server.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { BlocksBuilder, type BlocksField } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import { prototypeKebab } from '$lib/core/prototype/naming.js';
import { isCamelCase } from '$lib/util/string.js';

function hasDuplicates(arr: string[]): string[] {
  return [...new Set(arr.filter((e, i, a) => a.indexOf(e) !== i))];
}

/**
 * Check if there are multiple occurences
 * of the same slug inside collections and areas
 */
function hasDuplicateSlug(config: Config) {
  const slugs: PrototypeSlug[] = [];
  for (const collection of config.collections || []) {
    slugs.push(collection.slug);
  }
  for (const area of config.areas || []) {
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
function validateSlugs(config: Config) {
  const errors: string[] = [];
  const slugs: string[] = [
    ...(config.collections || []).map((c) => c.slug),
    ...(config.areas || []).map((a) => a.slug)
  ];

  for (const slug of slugs) {
    // `$` marks a slug rime derived itself ($pages__versions, $mediasDirectories), built from an
    // author slug that was already validated. Skipped by the marker rather than by suffix, so core
    // never has to know what a feature appends.
    if (slug.startsWith('$')) continue;

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
 * Prevent the panel user collection slug
 * to be used elsewhere
 */
function hasUsersSlug(config: Config) {
  const invalid =
    (config.collections || []).filter((collection) => collection.slug === 'staff').length > 1;
  if (invalid) {
    return [`staff is a reserved slug for panel users`];
  }
  return [];
}

/**
 * Validate documents fields for each collections
 * and areas
 */
const validateFields = (config: Config) => {
  let errors: string[] = [];
  for (const collection of config.collections || []) {
    const collectionErrors = validateDocumentFields(collection, config);
    errors = [...errors, ...collectionErrors];
  }
  for (const area of config.areas || []) {
    const collectionErrors = validateDocumentFields(area, config);
    errors = [...errors, ...collectionErrors];
  }
  return errors;
};

/**
 *
 */
const validateDocumentFields = (documentConfig: BuiltCollection | BuiltArea, config: Config) => {
  const errors: string[] = [];
  const registeredBlocks: Record<string, BlocksField['blocks'][number]> = {};

  const validateBlockField = (fields: FieldBuilder[], blockType: string) => {
    const reserved = ['path', 'type', 'ownerId', 'position', 'locale'];
    for (const key of reserved) {
      if (
        fields
          .filter(isFormField)
          .map((f) => f.name)
          .filter((name) => name === key).length > 1
      ) {
        errors.push(`${key} is a reserved field in blocks (block ${blockType})`);
      }
    }
  };

  const validateRelationField = (field: RelationFieldBuilder) => {
    const collectionsSlugs = (config.collections || []).map((c) => c.slug);
    if (!collectionsSlugs.includes(field.get.relationTo)) {
      errors.push(
        `Relation field ${field.name} references unknown collection ${field.get.relationTo}, in ${documentConfig.type} ${documentConfig.slug}`
      );
    }
  };

  const validateFields = (fields: FieldBuilder[]) => {
    // Check for field name duplication at this level
    const duplicates = hasDuplicates(fields.filter(isFormField).map((f) => f.name));
    if (duplicates.length) {
      for (const duplicate of duplicates) {
        errors.push(
          `Duplicate field '${duplicate}' in ${documentConfig.type} '${documentConfig.slug}'`
        );
      }
    }

    function validateFieldName(name: string): boolean {
      // Regular expression to match
      // __group_foo__truc, fooBlablaBla, _hello_guys
      const pattern = /^(_+)?[a-zA-Z][a-zA-Z0-9_]*$/;
      // Check if string matches pattern and doesn't contain spaces or hyphens
      return pattern.test(name) && !name.includes('-') && !name.includes(' ');
    }

    function validateTabs(field: TabsBuilder) {
      const duplicates = hasDuplicates(field.get.tabs.map((t) => t.name));
      if (duplicates.length) {
        errors.push(`Dupplicate tab name ${duplicates} in ${documentConfig.slug}`);
      }
    }

    for (const field of fields) {
      // Recursive check first into Tabs since tabs are not Formfields
      if (field instanceof TabsBuilder) {
        validateTabs(field);
        for (const tab of field.get.tabs) {
          validateFields(tab.get.fields);
        }
      }

      // If field is not a Formfield eg. Separator then continue
      if (!isFormField(field)) {
        continue;
      }

      // A `$root()` field sits on the base row, which has no locales branch.
      if (field.get.root && field.get.localized) {
        errors.push(
          `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} with $root(), can't be localized`
        );
      }

      // Check for malformed field.name
      if (!validateFieldName(field.name)) {
        errors.push(
          `Field ${field.name} of ${documentConfig.type} ${documentConfig.slug} should be camelCase`
        );
      }

      // Recursive check into Blocks
      if (field instanceof BlocksBuilder) {
        for (const block of field.get.blocks) {
          if (block.name in registeredBlocks) {
            const blockDefinedButDiffer =
              JSON.stringify(registeredBlocks[block.name]) !== JSON.stringify(block);
            if (blockDefinedButDiffer) {
              errors.push(`Each block with same name should be identique (block ${block.name})`);
            }
          } else {
            registeredBlocks[block.name] = block;
          }
          validateFields(block.get.fields.filter(isFormField));
          validateBlockField(block.get.fields.filter(isFormField), block.name);
        }
        // Recursive check into Tree
      } else if (field instanceof TreeBuilder) {
        validateFields(field.get.fields.filter(isFormField));
        // Recursive check into Tabs
      } else if (field instanceof GroupFieldBuilder) {
        validateFields(field.get.fields.filter(isFormField));
        // Check relation field
      } else if (field instanceof RelationFieldBuilder) {
        validateRelationField(field);
      }
    }
  };

  validateFields(documentConfig.fields);

  return errors;
};

const hasDatabase = <T extends Config>(config: T) => {
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
 * ```
 */
function validateFeatures(config: Config) {
  const collections = config.collections || [];
  const areas = config.areas || [];

  return [
    ...collections.flatMap((c) => validateAuth(c)),
    ...[...collections, ...areas].flatMap((c) => validateVersions(c))
  ];
}

/**
 * Every prototype's `kebab` must actually be kebab.
 *
 * It is what the generated param matchers and every REST/panel URL are built from, so a slug
 * leaking into it produces routes like `/api/$mediasDirectories` — and a 404, since the matcher
 * and the link disagree with the config. That happened twice while the naming convention was
 * being switched: both features that derive a prototype built its kebab from a *slug* helper
 * instead of prototypeKebab. Neither is a type error, and neither shows up until a request is
 * made, so it is checked here where codegen already runs.
 */
function validateKebabs(config: Config) {
  const errors: string[] = [];
  const prototypes = [...(config.collections || []), ...(config.areas || [])];

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

function validate(config: Config): boolean {
  const validateFunctions = [
    hasDuplicateSlug,
    validateSlugs,
    validateKebabs,
    hasUsersSlug,
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
