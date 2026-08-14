import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { Field, FormField } from '$lib/fields/types.js';

interface ThumbnailFieldResult {
  field: FormFieldBuilder<FormField>;
  path: string;
}

export function findThumbnailField(
  fields: FieldBuilder<Field>[] = [],
  basePath: string = ''
): ThumbnailFieldResult | null {
  for (const field of fields) {
    // Direct check for isThumbnail
    if (
      field instanceof RelationFieldBuilder &&
      'isThumbnail' in field.raw &&
      field.raw.isThumbnail === true
    ) {
      const path = basePath ? `${basePath}.${field.name}` : field.name;
      return { field, path };
    }

    // Check in group
    if (field instanceof GroupFieldBuilder && field.__fields) {
      const groupPath = basePath ? `${basePath}.${field.name}` : field.name;
      const found = findThumbnailField(field.__fields, groupPath);
      if (found) return found;
    }

    // Check in tabs
    if (field instanceof TabsBuilder && field.__tabs) {
      for (const tab of field.__tabs) {
        if (tab.__fields) {
          const tabPath = basePath ? `${basePath}.${tab.name}` : tab.name;
          const found = findThumbnailField(tab.__fields, tabPath);
          if (found) return found;
        }
      }
    }
  }

  return null;
}
