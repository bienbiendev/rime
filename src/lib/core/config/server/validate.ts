import { isAuthConfig } from '$lib/core/collections/auth/util.js';
import type { BuiltArea, BuiltCollection, Config } from '$lib/core/config/types.js';
import cache from '$lib/core/dev/cache/index.js';
import { isFormField } from '$lib/core/fields/util.js';
import type { PrototypeSlug } from '$lib/core/types/doc.js';
import { isBlocksFieldRaw, type BlocksFieldRaw } from '$lib/fields/blocks/index.js';
import { isGroupFieldRaw } from '$lib/fields/group/index.js';
import { isSelectField } from '$lib/fields/select/index.js';
import { isTabsFieldRaw } from '$lib/fields/tabs/index.js';
import { isTreeFieldRaw } from '$lib/fields/tree/index.js';
import type { FormField } from '$lib/fields/types.js';

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
    const collectionErrors = validateDocumentFields(collection);
    errors = [...errors, ...collectionErrors];
  }
  for (const area of config.areas || []) {
    const collectionErrors = validateDocumentFields(area);
    errors = [...errors, ...collectionErrors];
  }
  return errors;
};

/**
 *
 */
const validateDocumentFields = (config: BuiltCollection | BuiltArea) => {
  const errors: string[] = [];
  const isCollection = (config: any): config is BuiltCollection => config.type === 'collection';
  const isAuth = isCollection(config) && isAuthConfig(config);
  const registeredBlocks: Record<string, BlocksFieldRaw['blocks'][number]> = {};

  const fieldsCompiled = config.fields.map((f) => f.compile());

  if (isAuth) {
    const rolesField = fieldsCompiled
      .filter(isFormField)
      .filter((f) => f.name === 'roles')
      .filter((f) => isSelectField(f))[0];

    const nameField = fieldsCompiled.filter(isFormField).filter((f) => f.name === 'name')[0];
    const emailField = fieldsCompiled
      .filter(isFormField)
      .find((f: FormField) => f.name === 'email' && f.type === 'email');

    if (!rolesField) errors.push(`Field roles is missing in collection ${config.slug}`);
    if (!emailField && config.auth.type !== 'apiKey')
      errors.push(`Field email is missing in collection ${config.slug}`);
    if (!nameField) errors.push(`Field name is missing in collection ${config.slug}`);
    if (!rolesField.many)
      errors.push(
        `Field roles must have "many" enabled : select('roles').options(...).many(), even with a single option`
      );
  }

  const validateBlockField = (fields: FormField[], blockType: string) => {
    const reserved = ['path', 'type', 'ownerId', 'position', 'locale'];
    for (const key of reserved) {
      if (fields.map((f) => f.name).filter((name) => name === key).length > 1) {
        errors.push(`${key} is a reserved field in blocks (block ${blockType})`);
      }
    }
  };

  const validateFormFields = (fields: FormField[]) => {
    // Check for field name duplication at this level
    const duplicates = hasDuplicates(fields.map((f) => f.name));
    if (duplicates.length) {
      for (const duplicate of duplicates) {
        errors.push(`Duplicate field '${duplicate}' in ${config.type} '${config.slug}'`);
      }
    }

    function validateFieldName(name: string): boolean {
      // Regular expression to match
      // __group_foo__truc, fooBlablaBla, _hello_guys
      const pattern = /^(_+)?[a-zA-Z][a-zA-Z0-9_]*$/;
      // Check if string matches pattern and doesn't contain spaces or hyphens
      return pattern.test(name) && !name.includes('-') && !name.includes(' ');
    }

    for (const field of fields) {
      // Check that a field wich has field._root = true is not localized
      if ('_root' in field && field._root && field.localized) {
        errors.push(
          `Field ${field.name} of ${config.type} ${config.slug} with _root = true, can't be localized`
        );
      }

      // Check for malformed field.name
      if (!validateFieldName(field.name)) {
        errors.push(`Field ${field.name} of ${config.type} ${config.slug} should be camelCase`);
      }

      // Recursive check into Blocks Groups and Tabs
      if (isBlocksFieldRaw(field)) {
        for (const block of field.blocks) {
          if (block.name in registeredBlocks) {
            const blockDefinedButDiffer =
              JSON.stringify(registeredBlocks[block.name]) !== JSON.stringify(block);
            if (blockDefinedButDiffer) {
              errors.push(`Each block with same name should be identique (block ${block.name})`);
            }
          } else {
            registeredBlocks[block.name] = block;
          }
          validateFormFields(block.fields.filter(isFormField));
          validateBlockField(block.fields.filter(isFormField), block.name);
        }
      } else if (isTreeFieldRaw(field)) {
        validateFormFields(field.fields.filter(isFormField));
      } else if (isTabsFieldRaw(field)) {
        for (const tab of field.tabs) {
          validateFormFields(tab.fields.filter(isFormField));
        }
      } else if (isGroupFieldRaw(field)) {
        validateFormFields(field.fields.filter(isFormField));
      }
    }
  };

  validateFormFields(config.fields.map((f) => f.compile()).filter(isFormField));

  return errors;
};

const hasDatabase = <T extends Config>(config: T) => {
  const hasDatabaseName = '$adapter' in config;
  if (!hasDatabaseName) {
    return ['config.$adapter not defined'];
  }
  return [];
};

function validateAuthCollections<T extends Config>(config: T) {
  const errors = [];
  const authCollections = (config.collections || []).filter(isAuthConfig);
  for (const collection of authCollections) {
    if (collection.versions) {
      errors.push(`Auth collections can't be versionned (${collection.slug})`);
    }
  }
  return errors;
}

function validate(config: Config): boolean {
  const validateFunctions = [
    hasDuplicateSlug,
    hasUsersSlug,
    validateFields,
    hasDatabase,
    validateAuthCollections
  ];

  for (const isValid of validateFunctions) {
    const errors: string[] = isValid(config);
    if (errors.length) {
      cache.clear();
      throw new Error('Config error : ' + errors[0]);
    }
  }

  return true;
}

export default validate;
