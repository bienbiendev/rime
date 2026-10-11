import { describe, expect, it } from 'vitest';
import { text } from '#lib/fields/text/index.js';
import { create } from './definition.js';

/**
 * What `create` leaves on a built collection for the dashboard to read.
 *
 * The layout is offered by whichever feature has an opinion — `upload` sets `_dashboardLayout`,
 * the same device as `_titleFallback` — and defaulted by the dashboard, its only reader. Nothing
 * between the two names a feature.
 */
describe('create and the dashboard layout', () => {
  it('leaves a plain collection with no layout preference', () => {
    const built = create('spec_pages', { fields: [text('title').isTitle()] });

    expect(built._dashboardLayout).toBeUndefined();
  });

  it('carries the grid upload asks for', () => {
    const built = create('spec_medias', { upload: true, fields: [text('alt')] });

    expect(built._dashboardLayout).toBe('grid');
  });
});
