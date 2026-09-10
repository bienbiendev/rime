import { describe, expect, it } from 'vitest';
import { create } from '$lib/core/prototype/collection/definition.js';
import { text } from '$lib/fields/text/index.js';
import { contributionsFor } from './contributions.server.js';

/**
 * What each feature adds to a generated document type.
 *
 * `dev/codegen/types` wrote these itself — `if (collection.versions) push('versionId: string')`
 * and three reads of `collection.upload`. They are `docType` contributions now, and the reason
 * this file exists is that **`bun run check` does not catch losing one**: deleting versions'
 * contribution drops `versionId` from every generated doc type and the `versions` fixture still
 * type-checks at 0, because nothing in it reads `doc.versionId` in a typed position. A consumer
 * would find out, at their own compile, whenever they next upgraded.
 *
 * So the contributions are asserted through the very function codegen calls, on real built
 * configs.
 */
const contributionFor = (config: Parameters<typeof contributionsFor>[0]) =>
  contributionsFor(config);

describe('docType contributions', () => {
  it('adds nothing for a config whose features contribute nothing', () => {
    const plain = create('spec_doctype_pages', { fields: [text('title').isTitle()] });

    const contribution = contributionFor(plain);

    expect(contribution.extends).toEqual([]);
    expect(contribution.members).toEqual([]);
    expect(contribution.fields(text('anything'))).toBe(true);
  });

  it('gives a versioned config the id of the version it was read as', () => {
    const versioned = create('spec_doctype_news', {
      versions: { draft: true },
      fields: [text('title').isTitle()]
    });

    expect(contributionFor(versioned).members).toEqual(['versionId: string']);
  });

  it('intersects an upload config with UploadDoc, and asks codegen to import it', () => {
    const upload = create('spec_doctype_files', {
      upload: true,
      fields: [text('alt')]
    });

    const contribution = contributionFor(upload);

    expect(contribution.extends).toEqual(['UploadDoc']);
    // The augment gives every upload collection a `thumbnail` size, so there is always one.
    expect(contribution.members).toEqual(['sizes:{thumbnail: string}']);
    expect(contribution.fields(text('alt'))).toBe(true);
    expect(contribution.fields(text('thumbnail'))).toBe(false);
  });

  it('describes image sizes once, and drops the fields they generated', () => {
    const sized = create('spec_doctype_medias', {
      upload: {
        imageSizes: [
          { name: 'sm', width: 100 },
          { name: 'lg', width: 800 }
        ]
      },
      fields: [text('alt')]
    });

    const contribution = contributionFor(sized);

    expect(contribution.members).toEqual(['sizes:{thumbnail: string, sm: string, lg: string}']);
    // `sm` and `lg` are columns, and their type comes from the member above. Generating them from
    // their builders too would declare each twice.
    expect(contribution.fields(text('sm'))).toBe(false);
    expect(contribution.fields(text('lg'))).toBe(false);
    expect(contribution.fields(text('alt'))).toBe(true);
  });

  it('names one member per output format when a size has several', () => {
    const multi = create('spec_doctype_multi', {
      upload: { imageSizes: [{ name: 'hero', width: 800, out: ['webp', 'jpg'] }] },
      fields: [text('alt')]
    });

    expect(contributionFor(multi).members).toEqual([
      'sizes:{thumbnail: string, hero_webp: string, hero_jpg: string}'
    ]);
  });

  it('ANDs the predicates, so a config with both features keeps both answers', () => {
    const both = create('spec_doctype_both', {
      versions: true,
      upload: { imageSizes: [{ name: 'sm', width: 100 }] },
      fields: [text('alt')]
    });

    const contribution = contributionFor(both);

    expect(contribution.extends).toEqual(['UploadDoc']);
    expect(contribution.members).toEqual([
      'sizes:{thumbnail: string, sm: string}',
      'versionId: string'
    ]);
    expect(contribution.fields(text('sm'))).toBe(false);
  });
});
