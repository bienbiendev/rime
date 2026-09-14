import { create } from '$lib/core/prototype/collection/definition.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
import { text } from '$lib/fields/text/index.js';
import { describe, expect, it } from 'vitest';
import { versionsReadQuery } from './read-query.js';

/**
 * Which content row a read means.
 *
 * `readPrototype` decoded this from `draft` + `versionId` + `config.versions.draft`, and getting
 * it wrong is **silent in the worst direction**: no narrowing at all returns the newest row, so a
 * published-only read starts handing out unpublished drafts with a 200. Nothing else in the stack
 * would catch that — the document is well-formed, it is just the wrong revision.
 *
 * Asserted through the same function the api context calls, on real built configs.
 */
const queryFor = (
  config: Parameters<typeof versionsReadQuery>[0]['config'],
  params: { latest?: boolean; versionId?: string }
) => versionsReadQuery({ config, params });

describe('versionsReadQuery', () => {
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
    expect(queryFor(drafts, { latest: true })).toBeUndefined();
  });

  it('names the row when the caller named a version, whatever its status', () => {
    expect(queryFor(drafts, { versionId: 'v9' })).toEqual({
      where: { versionId: { equals: 'v9' } }
    });
  });

  it('prefers a named version over the published filter', () => {
    // Both parameters arrive together on `?versionId=v9` requests from the panel.
    expect(queryFor(drafts, { versionId: 'v9', latest: false })).toEqual({
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

  /**
   * An auto-saved row is one user's typing. Every ordinary read skips it; only its `versionId`
   * reaches it, which is what the panel's resume does.
   */
  describe('with auto-save', () => {
    const autoSave = create('spec_read_auto', {
      versions: { draft: true, autoSave: true },
      fields: [text('title').isTitle()]
    });
    const notAutoSaved = { isAutoSave: { not_equals: true } };
    const published = { status: { equals: VERSIONS_STATUS.PUBLISHED } };

    it('skips auto-saved rows on top of the published filter', () => {
      expect(queryFor(autoSave, {})).toEqual({ where: { and: [notAutoSaved, published] } });
    });

    it('skips auto-saved rows when the latest is asked for: the newest real row', () => {
      expect(queryFor(autoSave, { latest: true })).toEqual({ where: notAutoSaved });
    });

    it('skips them as an update original too', () => {
      expect(queryFor(autoSave, { latest: false })).toEqual({
        where: { and: [notAutoSaved, published] }
      });
    });

    it('reaches one by its versionId', () => {
      expect(queryFor(autoSave, { versionId: 'a1', latest: true })).toEqual({
        where: { versionId: { equals: 'a1' } }
      });
    });
  });

  /**
   * What `getOriginalDocument` asks for: the row an update starts from. It reads with
   * `latest: false` whatever the request said, so on a draft config that is the published row,
   * and a named version is that row.
   */
  describe("as an update's original", () => {
    it('is the published version on a draft config', () => {
      expect(queryFor(drafts, { latest: false })).toEqual({
        where: { status: { equals: VERSIONS_STATUS.PUBLISHED } }
      });
    });

    it('is the named version when one was named', () => {
      expect(queryFor(drafts, { versionId: 'v9', latest: false })).toEqual({
        where: { versionId: { equals: 'v9' } }
      });
    });

    it('is the newest row on a versioned config with no drafts', () => {
      const versioned = create('spec_read_original_medias', {
        versions: true,
        fields: [text('alt')]
      });

      expect(queryFor(versioned, { latest: false })).toBeUndefined();
    });
  });

  it('narrows to nothing when no feature gives the config a content row', () => {
    const plain = create('spec_read_pages', { fields: [text('title').isTitle()] });

    expect(queryFor(plain, {})).toBeUndefined();
    expect(queryFor(plain, { latest: true })).toBeUndefined();
  });
});
