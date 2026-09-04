import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { marksOf } from '$lib/core/pipeline/resolve-pipeline.server.js';
import { create } from './index.server.js';

/**
 * Guards the one failure in this repo that raises no error at all.
 *
 * A built config's pipeline is composed from two lists — the prototype's own hooks and those of
 * the features it lists. Reach either through `definition.server.ts` and the factory depends on an
 * evaluation order, because that file spreads `{ ...base }` at module scope: enter it too early
 * and the spread comes out without `features`, so **every feature hook silently stops running**.
 * Nothing throws. The types are unchanged. The schema is unchanged. A document just comes back
 * with no `title` and no `url`, which is what happened when adding one feature to the collection's
 * list reordered the graph.
 *
 * So: build a real collection and assert both layers are in its pipeline.
 */
describe('a built collection carries both layers of its pipeline', () => {
  const collection = create('pipeline_spec_pages', {
    fields: [text('title').isTitle()],
    $url: (doc) => `/${doc.id}`
  }) as unknown as { $hooks: Record<string, unknown[]> };

  const named = (timing: string) => (collection.$hooks[timing] ?? []).map((h) => marksOf(h).name);

  it('runs the prototype own hooks', () => {
    expect(named('beforeRead')).toContain('processDocumentFields');
    expect(named('beforeOperation')).toContain('authorize');
  });

  it('runs the hooks its features contribute', () => {
    // title and thumbnail are unconditional; url is on because this config declares `$url`.
    expect(named('beforeRead')).toContain('setDocumentTitle');
    expect(named('beforeRead')).toContain('setDocumentThumbnail');
    expect(named('beforeRead')).toContain('populateURL');
  });
});
