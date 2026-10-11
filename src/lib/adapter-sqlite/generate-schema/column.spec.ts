import { describe, expect, it } from 'vitest';
import { FormFieldBuilder, type DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { select, time } from '#lib/fields/index.js';
import { date } from '#lib/fields/date/index.js';
import { text } from '#lib/fields/text/index.js';
import { toSchemaColumn } from './column.server.js';

describe('toSchemaColumn', () => {
  it('gives a required text column an empty string default', () => {
    expect(toSchemaColumn(text('title').required())).toBe(
      `title: text('title').notNull().default("")`
    );
  });

  it('gives a required date column a Date default', () => {
    expect(toSchemaColumn(date('from').required())).toBe(
      `from: integer('from', { mode: 'timestamp_ms' }).notNull().default(new Date(0))`
    );
    expect(toSchemaColumn(date('from').required().defaultValue(new Date(1000)))).toBe(
      `from: integer('from', { mode: 'timestamp_ms' }).notNull().default(new Date(1000))`
    );
  });

  it('gives every required column a default its type can hold', () => {
    expect(toSchemaColumn(select('kind').options('a').required())).toBe(
      `kind: text('kind').notNull().default("")`
    );
    expect(toSchemaColumn(select('tags').options('a').many().required())).toContain('.default([])');
    expect(
      toSchemaColumn(
        select('tags')
          .options('a')
          .many()
          .required()
          .defaultValue(() => ['a'])
      )
    ).toContain('.default([])');
    expect(toSchemaColumn(time('at').required())).toContain('.default("08:00")');
    expect(
      toSchemaColumn(
        time('at')
          .required()
          .defaultValue(() => '09:00')
      )
    ).toContain('.default("00:00")');
  });

  it('gives a required field from a package a default of its storage type', () => {
    class ColorPickerFieldBuilder extends FormFieldBuilder {
      get dataType(): DataType {
        return 'text';
      }
    }
    const tint = new ColorPickerFieldBuilder('tint', 'colorPicker').required();
    expect(toSchemaColumn(tint)).toBe(`tint: text('tint').notNull().default("")`);
  });
});
