import type { GenericBlock } from '$lib/core/types/doc.js';
import { BlocksBuilder, isBlocksFieldRaw } from '$lib/fields/blocks/index.js';
import { GroupFieldBuilder, isGroupFieldRaw } from '$lib/fields/group/index.js';
import { isTabsFieldRaw, TabsBuilder } from '$lib/fields/tabs/index.js';
import { isTreeFieldRaw } from '$lib/fields/tree/index.js';
import type { Field, FormField, SeparatorField } from '$lib/fields/types.js';
import type { Dic } from '$lib/util/types.js';
import type { FieldBuilder } from './builders';

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
export const isFormField = (field: Field): field is FormField => 'name' in field;

/**
 * Checks if a form field is not hidden.
 */
export const isNotHidden = (field: FormField) => !field.hidden;

/**
 * Checks if a field has live updates enabled.
 */
export const isLiveField = (field: Field) => field.live;

/**
 * Flattens a nested field structure into an array of form fields.
 * Handles special field types like tabs, tree, and blocks.
 *
 * @example
 * // Flattens a tabs field into its constituent form fields
 * const fields = [tabsField].reduce(toFormFields, []);
 */
export function toFormFields(prev: any[], curr: any) {
  if (curr.type === 'tabs') {
    return curr.tabs.reduce(toFormFields, prev);
  } else if (curr.type === 'tree') {
    curr = {
      ...curr,
      fields: curr.fields.reduce(toFormFields, [])
    };
  } else if (curr.type === 'blocks') {
    curr = {
      ...curr,
      blocks: curr.blocks.map((b: GenericBlock) => ({
        ...b,
        fields: b.fields.reduce(toFormFields, [])
      }))
    };
  } else if ('fields' in curr) {
    return curr.fields.reduce(toFormFields, prev);
  }
  prev.push(curr);
  return prev;
}

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
export const emptyValuesFromFieldConfig = <T extends FormField>(arr: T[]): Dic => {
  return Object.fromEntries(
    arr.map((config) => {
      let emptyValue;

      // Handle group fields - create nested object structure
      if (isGroupFieldRaw(config)) {
        emptyValue = emptyValuesFromFieldConfig(config.fields.filter(isFormField));
      }
      // Handle tabs fields - create nested object structure for each tab
      else if (isTabsFieldRaw(config)) {
        const tabsValue: Dic = {};
        const tabs = config.tabs;
        for (const tab of tabs) {
          if ('fields' in tab) {
            tabsValue[tab.name] = emptyValuesFromFieldConfig(tab.fields.filter(isFormField));
          }
        }
        emptyValue = tabsValue;
      }
      // Handle default values
      else if ('defaultValue' in config) {
        emptyValue =
          typeof config.defaultValue === 'function' ? config.defaultValue() : config.defaultValue;
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
 * const titleField = getFieldConfigByPath('attributes.title', collection.fields);
 *
 * // Get the title field in a specific block
 * const titleField = getFieldConfigByPath('attributes.layout.2:blockType.title', collection.fields);
 *
 */
export const getFieldConfigByPath = (path: string, fields: Field[]) => {
  const parts = path.split('.');

  const findInFields = (
    currentFields: Field[],
    remainingParts: string[]
  ): FormField | undefined => {
    if (remainingParts.length === 0) return undefined;

    const currentPart = remainingParts[0];

    for (const field of currentFields) {
      // Handle tabs
      if (isTabsFieldRaw(field)) {
        const tab = field.tabs.find((t) => t.name === currentPart);
        if (tab) {
          return findInFields(tab.fields, remainingParts.slice(1));
        }
        continue;
      }

      // Handle regular fields
      if (isFormField(field)) {
        if (field.name === currentPart) {
          if (remainingParts.length === 1) {
            return field;
          }

          if (isGroupFieldRaw(field)) {
            return findInFields(field.fields, remainingParts.slice(1));
          }

          // Handle blocks
          if (isBlocksFieldRaw(field) && remainingParts.length > 1) {
            // const blockPartPattern = /:[a-zA-Z0-9]+/
            const blockType = remainingParts[1].split(':')[1];

            if (blockType) {
              const block = field.blocks.find((b) => b.name === blockType);
              if (block) {
                return findInFields(block.fields, remainingParts.slice(2));
              }
            }
          }

          if (isTreeFieldRaw(field)) {
            return findInFields(field.fields, remainingParts.slice(2));
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
export function getFieldBuildersAtPath(
  fieldPath: string,
  builders: FieldBuilder[],
  _prefix = ''
): { fields: FieldBuilder[]; path: string } {
  if (!fieldPath) return { fields: builders, path: _prefix };

  const dotIndex = fieldPath.indexOf('.');
  const head = dotIndex === -1 ? fieldPath : fieldPath.slice(0, dotIndex);
  const tail = dotIndex === -1 ? '' : fieldPath.slice(dotIndex + 1);

  for (const builder of builders) {
    // ── Tabs container: navigate into the matching tab
    if (builder instanceof TabsBuilder) {
      const tab = builder.field.tabs.find((t: any) => t.name === head);
      if (!tab) continue;
      const prefix = _prefix ? `${_prefix}.${head}` : head;
      if (!tail) {
        // Path targets the tab → return all its inner fields
        return { fields: tab.raw.fields, path: prefix };
      }
      return getFieldBuildersAtPath(tail, tab.raw.fields, prefix);
    }

    if (!('name' in builder.raw) || builder.raw.name !== head) continue;

    const prefix = _prefix ? `${_prefix}.${head}` : head;

    // ── Group field: navigate into children
    if (builder instanceof GroupFieldBuilder) {
      const children = (builder as any).field.fields as FieldBuilder[];
      if (!tail) return { fields: children, path: prefix };
      return getFieldBuildersAtPath(tail, children, prefix);
    }

    // ── Blocks field: endpoint — return the builder itself
    // Ignore any index:type suffix (e.g. 'sections.2:paragraph' stops here)
    if (builder instanceof BlocksBuilder) {
      return { fields: [builder], path: _prefix };
    }

    // ── Single field
    return { fields: [builder], path: _prefix };
  }

  console.warn(`[LiveEditPanel] fieldPath "${fieldPath}" not found in config fields`);
  return { fields: builders, path: _prefix };
}
