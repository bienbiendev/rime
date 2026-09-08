import { describe, expect, it } from 'vitest';
import { group } from '$lib/fields/group/index.js';
import { text } from '$lib/fields/text/index.js';
import { collection, create } from '$lib/core/prototype/collection/definition.js';
import { createBlankDocument } from '$lib/core/prototype/doc.js';
import { blankWithFeatures } from '../registry.js';
import { blankAuthDocument } from './blank/module.server.js';

/**
 * What a feature takes off the blank document the local API hands out.
 *
 * `prototype/api.server.ts` used to special-case auth here, behind an `isAuthConfig` test. The
 * risk in moving it is that it quietly stops running and a blank auth document starts carrying a
 * password key — which nothing else would catch, since blank documents are not persisted.
 */
describe('blankAuthDocument', () => {
  it('drops every private member', () => {
    const clean = blankAuthDocument({
      name: null,
      email: null,
      password: null,
      token: null,
      isSuperAdmin: null,
      apiKeyId: null,
      authUserId: null,
      isStaff: null
    });

    expect(Object.keys(clean)).toEqual(['name', 'email']);
  });

  it('leaves a document with none of them alone', () => {
    expect(blankAuthDocument({ title: null, body: null })).toEqual({ title: null, body: null });
  });
});

describe('blankWithFeatures', () => {
  const blankFor = (config: Parameters<typeof createBlankDocument>[0]) =>
    blankWithFeatures(collection.features, createBlankDocument(config), config) as Record<
      string,
      unknown
    >;

  it('strips an auth collection through the feature list', () => {
    const built = create('spec_blank_users', { auth: true, fields: [text('bio')] });

    const blank = blankFor(built);

    expect('password' in blank).toBe(false);
    expect('bio' in blank).toBe(true);
    expect('name' in blank).toBe(true);
  });

  it('leaves a collection with no auth untouched', () => {
    const built = create('spec_blank_pages', { fields: [text('title').isTitle()] });

    expect(blankFor(built)).toEqual(createBlankDocument(built));
  });

  /**
   * The inline version filtered `config.fields` down to `FormFieldBuilder`s before building, and a
   * group is not one — so a blank auth document came back without it. Stripping the built document
   * instead keeps everything that is not private.
   */
  it('keeps a group on an auth collection, which the old field filter dropped', () => {
    const built = create('spec_blank_grouped', {
      auth: true,
      fields: [group('profile').fields(text('city'))]
    });

    expect(blankFor(built).profile).toEqual({ city: null });
  });
});

/**
 * And the branch that went: `createBlankDocument` seeded `sizes: {}` behind a check for
 * `config.imageSizes`, which is a member of `UploadConfig` and so never present on a collection.
 * It never ran, and nothing reads `sizes` off a blank document.
 */
describe('createBlankDocument', () => {
  it('names no feature member for an upload collection', () => {
    const built = create('spec_blank_medias', {
      upload: { imageSizes: [{ name: 'sm', width: 10 }] },
      fields: [text('alt')]
    });

    const blank = createBlankDocument(built) as Record<string, unknown>;

    expect('sizes' in blank).toBe(false);
    expect(blank.alt).toBeNull();
  });
});
