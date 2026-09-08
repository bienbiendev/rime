import { collection, create } from '$lib/core/prototype/collection/definition.js';
import { VERSIONS_STATUS } from '$lib/core/constants.js';
import { text } from '$lib/fields/text/index.js';
import { describe, expect, it } from 'vitest';
import { readQueryOf } from '../registry.js';

/**
 * Which content row a read means.
 *
 * `readPrototype` decoded this from `draft` + `versionId` + `config.versions.draft`, and getting
 * it wrong is **silent in the worst direction**: no narrowing at all returns the newest row, so a
 * published-only read starts handing out unpublished drafts with a 200. Nothing else in the stack
 * would catch that — the document is well-formed, it is just the wrong revision.
 *
 * Asserted through the same fold the api context uses, on real built configs.
 */
const queryFor = (
  config: Parameters<typeof readQueryOf>[1],
  params: { draft?: boolean; versionId?: string }
) => readQueryOf(collection.features, config, params);

describe('readQueryOf', () => {
  const drafts = create('spec_read_news', {
    versions: { draft: true },
    fields: [text('title').isTitle()]
  });

  it('narrows to the published row by default', () => {
    expect(queryFor(drafts, {})).toEqual({
      where: { status: { equals: VERSIONS_STATUS.PUBLISHED } }
    });
  });

  it('narrows to nothing when drafts are asked for, which the adapter reads as the newest', () => {
    expect(queryFor(drafts, { draft: true })).toBeUndefined();
  });

  it('names the row when the caller named a version, whatever its status', () => {
    expect(queryFor(drafts, { versionId: 'v9' })).toEqual({
      where: { versionId: { equals: 'v9' } }
    });
  });

  it('prefers a named version over the published filter', () => {
    // Both parameters arrive together on `?versionId=v9` requests from the panel.
    expect(queryFor(drafts, { versionId: 'v9', draft: false })).toEqual({
      where: { versionId: { equals: 'v9' } }
    });
  });

  it('narrows to nothing for a versioned config with no drafts', () => {
    // There is no meaningful status on its rows; filtering on one would match nothing at all.
    const versioned = create('spec_read_medias', {
      versions: true,
      fields: [text('alt')]
    });

    expect(queryFor(versioned, {})).toBeUndefined();
  });

  it('narrows to nothing when no feature gives the config a content row', () => {
    const plain = create('spec_read_pages', { fields: [text('title').isTitle()] });

    expect(queryFor(plain, {})).toBeUndefined();
    expect(queryFor(plain, { draft: true })).toBeUndefined();
  });
});
