import { describe, expect, it, vi } from 'vitest';
import { create } from '#lib/core/prototype/collection/definition.js';
import { text } from '#lib/fields/text/index.js';
import type { Dic } from '#lib/util/types.js';
import { configureConfig } from './configure.js';

// configureCors always trusts the site's own origin, read from SITE_URL
vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com' }));

/**
 * What the whole-config steps leave on a collection's `panel`, the value the dashboard and the
 * navigation read: `panel !== false` lists a collection.
 */
describe('configureConfig and a collection panel', () => {
  it('keeps `panel: false` and an authored panel through the config chain', () => {
    const hidden = create('spec_hidden', { panel: false, fields: [text('title')] });
    const authored = create('spec_authored', {
      panel: { group: 'content', dashboard: { layout: 'rows', maxEntries: 3 } },
      fields: [text('title')]
    });

    const { collections } = configureConfig({ collections: [hidden, authored], areas: [] });
    const panelOf = (slug: string) => collections.find((c: Dic) => c.slug === slug)!.panel;

    expect(panelOf('spec_hidden')).toBe(false);
    expect(panelOf('spec_authored')).toEqual({
      group: 'content',
      dashboard: { layout: 'rows', maxEntries: 3 }
    });
  });
});
