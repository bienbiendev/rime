import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { Field, FormField, SeparatorField } from '$lib/fields/types.js';
import { normalizeFieldPath } from '$lib/util/path.js';
import type { Dic } from '$lib/util/types.js';
import type { FormFieldBuilder } from './builders/form-field-builder.js';
import type { FieldBuilder } from './builders/index.js';

/**
 * Checks if a field is a presentative field (currently only separator fields).
 * Presentative fields are used for UI organization and don't store data.
 */
export const isPresentative = (field: Field): field is SeparatorField =>
  ['separator'].includes(field.type);

/**
 * Checks if a field is a form field (has a name property).
 * Form fields are fields that can store data in documents.
 */
export const isFormField = <T extends Field>(
  field: FieldBuilder<T>
): field is FormFieldBuilder<T & FormField> => field.name !== '';

/**
 * Checks if a form field is not hidden.
 */
export const isNotHidden = <T extends FormField>(field: FormFieldBuilder<T>) => !field.get.hidden;

/**
 * Checks if a field has live updates enabled.
 */
export const isLiveField = (field: Field) => field.live;

/**
 * Creates an object with empty values based on field configurations.
 * Uses defaultValue if specified, otherwise undefined.
 * Handles nested fields like groups and tabs recursively.
 *
 * @example
 * // Returns { title: '', attributes: { name: '', description: '' } }
 * emptyValuesFromFieldConfig([
 *   { name: 'title', type: 'text', defaultValue: '' },
 *   { name: 'attributes', type: 'group', fields: [
 *     { name: 'name', type: 'text', defaultValue: '' },
 *     { name: 'description', type: 'text', defaultValue: '' }
 *   ]}
 * ]);
 */
export const emptyValuesFromFieldConfig = <T extends FormFieldBuilder>(arr: T[]): Dic => {
  return Object.fromEntries(
    arr.map((config) => {
      let emptyValue;

      // Handle group fields - create nested object structure
      if (config instanceof GroupFieldBuilder) {
        emptyValue = emptyValuesFromFieldConfig(config.get.fields.filter(isFormField));
      }
      // Handle tabs fields - create nested object structure for each tab
      else if (config instanceof TabsBuilder) {
        const tabsValue: Dic = {};
        const tabs = config.get.tabs;
        for (const tab of tabs) {
          if ('fields' in tab) {
            tabsValue[tab.name] = emptyValuesFromFieldConfig(tab.get.fields.filter(isFormField));
          }
        }
        emptyValue = tabsValue;
      }
      // Handle default values
      else {
        emptyValue = config.use.defaultValue();
      }

      return [config.name, emptyValue];
    })
  );
};

/**
 * Converts a path with numeric indices to a regex pattern
 * Numbers between dots or between dot and colon are converted to \d+
 *
 * @example
 * pathToRegex('some.0.path3') // matches 'some.\\d+.path3'
 * pathToRegex('some.0:bar.path3') // matches 'some.\\d+:bar.path3'
 * pathToRegex('some.31.baz.bar:foo.ouep12') // matches 'some.\\d+.baz.bar:foo.ouep12'
 * pathToRegex('some.31.baz.bar:foo.4.ouep12') // matches 'some.\\d+.baz.bar:foo.\\d+.ouep12'
 */
export function pathToRegex(path: string): RegExp {
  // Escape special regex characters except dots and colons
  const escaped = path.replace(/[\\^$*+?{}[\]|()]/g, '\\$&');

  // Replace numeric indices that are:
  // - preceded by a dot: \.123
  // - followed by a dot or colon: 123\. or 123:
  const pattern = escaped.replace(/(?<=\.)(\d+)(?=[.:])|\b(\d+)(?=[.:])/g, '\\d+');

  return new RegExp(`^${pattern}$`);
}

/**
 * Retrieves a field configuration by its dot-notation path
 * @example
 * // Get the title field in the attributes group
 * const titleField = getFieldAtPath('attributes.title', collection.fields);
 *
 * // Get the title field in a specific block
 * const titleField = getFieldAtPath('attributes.layout.2:blockType.title', collection.fields);
 *
 */
export const getFieldAtPath = (path: string, fields: FieldBuilder[]) => {
  const parts = path.split('.');

  const findInFields = (
    currentFields: FieldBuilder[],
    remainingParts: string[]
  ): FormFieldBuilder | undefined => {
    if (remainingParts.length === 0) return undefined;

    const currentPart = remainingParts[0];

    for (const field of currentFields) {
      // Handle tabs
      if (field instanceof TabsBuilder) {
        const tab = field.get.tabs.find((t) => t.name === currentPart);
        if (tab) {
          return findInFields(tab.get.fields, remainingParts.slice(1));
        }
        continue;
      }

      // Handle regular fields
      if (isFormField(field)) {
        if (field.name === currentPart) {
          if (remainingParts.length === 1) {
            return field;
          }

          if (field instanceof GroupFieldBuilder) {
            return findInFields(field.get.fields, remainingParts.slice(1));
          }

          // Handle blocks
          if (field instanceof BlocksBuilder && remainingParts.length > 1) {
            // const blockPartPattern = /:[a-zA-Z0-9]+/
            const blockType = remainingParts[1].split(':')[1];

            if (blockType) {
              const block = field.get.blocks.find((b) => b.name === blockType);
              if (block) {
                return findInFields(block.get.fields, remainingParts.slice(2));
              }
            }
          }

          if (field instanceof TreeBuilder) {
            return findInFields(field.get.fields, remainingParts.slice(2));
          }
        }
      }
    }

    return undefined;
  };

  return findInFields(fields, parts);
};

/**
 * Traverses a FieldBuilder[] tree and returns the subset of builders to pass to
 * RenderFields, along with the path prefix those builders should be rendered at.
 *
 * Containers (tabs, groups) are treated as transparent navigation layers.
 * Blocks are treated as endpoints — the blocks builder itself is returned
 * regardless of any index:blockType suffix in the path.
 */
export function getFieldListAtPath(
  fieldPath: string,
  fields: FieldBuilder[],
  parentPath = ''
): { fields: FieldBuilder[]; path: string } {
  if (!fieldPath) return { fields, path: parentPath };

  const dotIndex = fieldPath.indexOf('.');
  const head = dotIndex === -1 ? fieldPath : fieldPath.slice(0, dotIndex);
  const tail = dotIndex === -1 ? '' : fieldPath.slice(dotIndex + 1);
  const isEndpoint = fieldPath.split('.').length === 1;

  const nextParentPath = normalizeFieldPath(`${parentPath}${parentPath ? '.' : ''}${head}`);

  for (const field of fields) {
    // ── Tabs container: navigate into the matching tab
    if (field instanceof TabsBuilder) {
      const tab = field.field.tabs.find((t: any) => t.name === head);
      if (!tab) continue;

      if (isEndpoint) {
        // Path targets the tab → return all its inner fields
        return { fields: tab.get.fields, path: nextParentPath };
      }
      return getFieldListAtPath(tail, tab.get.fields, nextParentPath);
    }

    if (!isFormField(field)) continue;

    // ── Group field: navigate into children
    if (field instanceof GroupFieldBuilder && field.name === head) {
      const children = field.get.fields;

      if (isEndpoint) return { fields: children, path: nextParentPath };
      return getFieldListAtPath(tail, children, nextParentPath);
    }

    // —— Blocks
    if (field instanceof BlocksBuilder && field.name === head) {
      const blockType = tail.split('.')[0]?.split(':')[1];
      const isInnerBlockLookup = tail.split('.').length > 1;
      const nextParentPathWithBlockIndex = `${nextParentPath}.${tail.split('.')[0]}`;

      if (blockType) {
        const block = field.get.blocks.find((b) => b.name === blockType);
        if (!isInnerBlockLookup && block?.get.fields) {
          return {
            fields: block.get.fields,
            path: normalizeFieldPath(nextParentPathWithBlockIndex)
          };
        }
        if (block) {
          return getFieldListAtPath(
            tail.split('.').slice(1).join('.'),
            block.get.fields,
            normalizeFieldPath(nextParentPathWithBlockIndex)
          );
        }
      }
      return { fields: [field], path: parentPath };
    }

    // Tree
    if (field instanceof TreeBuilder && field.name === head) {
      const children = field.get.fields;
      const nextParentPathWithIndex = `${nextParentPath}.${tail.split('.')[0]}`;
      if (isEndpoint) return { fields: children, path: nextParentPath };
      return getFieldListAtPath(
        tail.split('.').slice(1).join('.'),
        children,
        nextParentPathWithIndex
      );
    }

    // Direct unique field match
    if (isEndpoint && isFormField(field) && field.name === fieldPath) {
      return { fields: [field], path: parentPath };
    }
  }

  console.warn(`[LiveEditPanel] fieldPath "${fieldPath}" not found in config fields`);
  return { fields, path: parentPath };
}
