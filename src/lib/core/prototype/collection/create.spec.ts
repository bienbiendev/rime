import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { create } from './definition.js';

/**
 * What `create` leaves on a built collection, for the two things that used to be decided by the
 * prototype testing `config.upload`.
 *
 * The dashboard layout is offered by the feature that has an opinion — `upload` sets
 * `_dashboardLayout`, the same device as `_titleFallback` — and defaulted by the dashboard, its
 * only reader. Nothing between the two names a feature.
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

  /**
   * `augmentPanel` spread `config.panel || {}`, and `false || {}` is `{}` — so a collection that
   * asked to be hidden came out with a `panel` object instead, and every `panel !== false` reader
   * (the dashboard's filter, `panel/navigation.ts`) saw it as visible. The derived collections
   * upload and versions add were unaffected: they are built as plain objects, never through here.
   */
  it('keeps `panel: false` instead of turning it into an object', () => {
    const built = create('spec_hidden', { panel: false, fields: [text('title')] });

    expect(built.panel).toBe(false);
  });

  /** And what an author wrote is still what an author wrote. */
  it('leaves an authored panel alone', () => {
    const built = create('spec_authored', {
      panel: { group: 'content', dashboard: { layout: 'rows', maxEntries: 3 } },
      upload: true,
      fields: [text('alt')]
    });

    expect(built.panel).toEqual({ group: 'content', dashboard: { layout: 'rows', maxEntries: 3 } });
  });
});
