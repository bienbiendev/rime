import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DateField } from '$lib/fields/date/index.js';
import type { EmailField } from '$lib/fields/email/index.js';
import { GroupFieldBuilder } from '$lib/fields/group/index.js';
import type { SlugField } from '$lib/fields/slug/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { TextField } from '$lib/fields/text/index.js';
import type { Field, FormField, RichTextField } from '$lib/fields/types.js';

export const hasMaybeTitle = (
  field: Field
): field is TextField | DateField | SlugField | EmailField | RichTextField =>
  ['text', 'date', 'slug', 'email', 'richText'].includes(field.type);

interface TitleFieldResult {
  field: FormFieldBuilder<FormField>;
  path: string;
}

export function findTitleField(
  fields: FieldBuilder<Field>[] = [],
  basePath: string = ''
): TitleFieldResult | null {
  for (const field of fields) {
    // Direct check for isTitle
    if (
      field instanceof FormFieldBuilder &&
      hasMaybeTitle(field.get) &&
      'isTitle' in field.get &&
      field.get.isTitle === true
    ) {
      const path = basePath ? `${basePath}.${field.name}` : field.name;
      return { field, path };
    }

    // Check in group
    if (field instanceof GroupFieldBuilder && field.get.fields) {
      const groupPath = basePath ? `${basePath}.${field.name}` : field.name;
      const found = findTitleField(field.get.fields, groupPath);
      if (found) return found;
    }

    // Check in tabs
    if (field instanceof TabsBuilder && field.get.tabs) {
      for (const tab of field.get.tabs) {
        if (tab.get.fields) {
          const tabPath = basePath ? `${basePath}.${tab.name}` : tab.name;
          const found = findTitleField(tab.get.fields, tabPath);
          if (found) return found;
        }
      }
    }
  }

  return null;
}
