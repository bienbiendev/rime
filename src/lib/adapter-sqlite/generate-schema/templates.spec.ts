import { describe, expect, it } from 'vitest';
import type { TableName } from '../naming.server.js';
import {
  templateFieldRelationColumn,
  templatePathsTable,
  templateTable
} from './templates.server.js';

describe('templateFieldRelationColumn', () => {
  it('keys the column by the slug and references the table by its name', () => {
    expect(templateFieldRelationColumn('medias')).toBe(
      "mediasId: text('medias_id').references(() => medias.id, { onDelete: 'cascade' })"
    );
    expect(templateFieldRelationColumn('eventsCategories')).toBe(
      "eventsCategoriesId: text('events_categories_id').references(() => events_categories.id, { onDelete: 'cascade' })"
    );
  });
});

describe('templateTable', () => {
  it('adds the primary key when a column only ends in id', () => {
    for (const name of ['paid', 'valid', 'grid']) {
      expect(
        templateTable('orders', `${name}: integer('${name}', { mode: 'boolean' }),`)
      ).toContain('id: pk()');
    }
  });

  it('keeps an id the content declares itself', () => {
    expect(templateTable('orders', "id: text('id'),")).not.toContain('id: pk()');
  });
});

describe('templatePathsTable', () => {
  // paths.server.spec.ts runs on a copy of this table: update the copy with this snapshot
  it('writes the paths table the paths spec copies', () => {
    expect(templatePathsTable('pages' as TableName)).toMatchInlineSnapshot(`
      "
      export const pages__$paths = sqliteTable('pages__$paths', {
        id: pk(),
        ownerId: text('owner_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
        locale: text('locale').notNull(),
        slug: text('slug').notNull(),
        parentPath: text('parent_path'),
        path: text('path').generatedAlwaysAs(sql\`coalesce(parent_path || '/', '') || slug\`, { mode: 'stored' }),
        url: text('url')
      }, (t) => [
        unique('pages__$paths_owner_locale').on(t.ownerId, t.locale),
        unique('pages__$paths_path').on(t.locale, t.path),
        index('pages__$paths_parent_idx').on(t.locale, t.parentPath),
        index('pages__$paths_url_idx').on(t.locale, t.url),
        check('pages__$paths_slug', sql\`slug <> ''\`),
        foreignKey({ columns: [t.locale, t.parentPath], foreignColumns: [t.locale, t.path] }).onUpdate('cascade')
      ]);
      "
    `);
  });
});
