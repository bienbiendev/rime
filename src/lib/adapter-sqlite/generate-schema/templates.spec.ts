import { describe, expect, it } from 'vitest';
import { templateFieldRelationColumn } from './templates.server.js';

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
