import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DateField } from '$lib/fields/date/index.js';
import type { EmailField } from '$lib/fields/email/index.js';
import { isGroupField } from '$lib/fields/group/index.js';
import type { SlugField } from '$lib/fields/slug/index.js';
import { TabsBuilder } from '$lib/fields/tabs/index.js';
import type { TextField } from '$lib/fields/text/index.js';
import type { Field, FormField } from '$lib/fields/types.js';

export const hasMaybeTitle = (
	field: Field
): field is TextField | DateField | SlugField | EmailField =>
	['text', 'date', 'slug', 'email'].includes(field.type);

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
			hasMaybeTitle(field.raw) &&
			'isTitle' in field.raw &&
			field.raw.isTitle === true
		) {
			const path = basePath ? `${basePath}.${field.raw.name}` : field.raw.name;
			return { field, path };
		}

		// Check in group
		if (isGroupField(field.raw) && field.raw.fields) {
			const groupPath = basePath ? `${basePath}.${field.raw.name}` : field.raw.name;
			const found = findTitleField(field.raw.fields, groupPath);
			if (found) return found;
		}

		// Check in tabs
		if (field instanceof TabsBuilder && field.raw.tabs) {
			for (const tab of field.raw.tabs) {
				if (tab.raw.fields) {
					const tabPath = basePath ? `${basePath}.${tab.raw.name}` : tab.raw.name;
					const found = findTitleField(tab.raw.fields, tabPath);
					if (found) return found;
				}
			}
		}
	}

	return null;
}
