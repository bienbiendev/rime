import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { isGroupField } from '$lib/fields/group/index.js';
import { RelationFieldBuilder } from '$lib/fields/relation';
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
			const path = basePath ? `${basePath}.${field.raw.name}` : field.raw.name;
			return { field, path };
		}

		// Check in group
		if (isGroupField(field.raw) && field.raw.fields) {
			const groupPath = basePath ? `${basePath}.${field.raw.name}` : field.raw.name;
			const found = findThumbnailField(field.raw.fields, groupPath);
			if (found) return found;
		}

		// Check in tabs
		if (field instanceof TabsBuilder && field.raw.tabs) {
			for (const tab of field.raw.tabs) {
				if (tab.raw.fields) {
					const tabPath = basePath ? `${basePath}.${tab.raw.name}` : tab.raw.name;
					const found = findThumbnailField(tab.raw.fields, tabPath);
					if (found) return found;
				}
			}
		}
	}

	return null;
}
