import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { ToggleFieldBuilder } from '$lib/fields/toggle/index.js';
import { isFormField } from '$lib/core/fields/util.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { toSchemaColumn } from '$lib/adapter-sqlite/generate-schema/column.server.js';

/**
 * The `isAutoSave` column. It has to reach the database as not null with a false default: the
 * read filter is `isAutoSave != true`, and a nullable column would make every version written
 * before the migration disappear from every read.
 */
describe('augmentVersions', () => {
  const fieldNamed = (config: { fields: any[] }, name: string) =>
    config.fields.filter(isFormField).find((field) => field.name === name);

  it('adds isAutoSave when autoSave is on', () => {
    const built = create('spec_auto_on', {
      versions: { draft: true, autoSave: true },
      fields: [text('title')]
    });
    const field = fieldNamed(built, 'isAutoSave')!;

    expect(field).toBeInstanceOf(ToggleFieldBuilder);
    expect(field.get.hidden).toBe(true);
    expect(field.get.required).toBe(true);
    expect(field.use.defaultValue()).toBe(false);
  });

  it('emits it not null with a false default', () => {
    const built = create('spec_auto_column', {
      versions: { draft: true, autoSave: true },
      fields: [text('title')]
    });

    expect(toSchemaColumn(fieldNamed(built, 'isAutoSave')!)).toBe(
      "isAutoSave: integer('is_auto_save', { mode: 'boolean' }).notNull().default(false)"
    );
  });

  it('adds nothing without autoSave', () => {
    const drafts = create('spec_drafts', { versions: { draft: true }, fields: [text('title')] });
    const plain = create('spec_plain', { versions: true, fields: [text('title')] });

    expect(fieldNamed(drafts, 'isAutoSave')).toBeUndefined();
    expect(fieldNamed(plain, 'isAutoSave')).toBeUndefined();
  });
});
