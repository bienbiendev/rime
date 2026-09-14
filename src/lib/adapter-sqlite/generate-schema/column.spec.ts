import { describe, expect, it } from 'vitest';
import { date } from '$lib/fields/date/index.js';
import { text } from '$lib/fields/text/index.js';
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
});
