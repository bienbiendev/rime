import { describe, expect, it } from 'vitest';
import { create } from '#lib/core/prototype/collection/definition.js';
import { create as createArea } from '#lib/core/prototype/area/definition.js';
import { text } from '#lib/fields/text/index.js';
import { block, blocks } from '#lib/fields/blocks/index.js';
import { contributionsFor } from './contributions.server.js';

/**
 * What each feature adds to a generated document type, read through `contributionsFor`, the
 * function codegen calls, on real built configs.
 *
 * `bun run check` does not catch a lost contribution: without versions' one, every generated doc
 * type loses `versionId`, and the `versions` fixture still type-checks, since nothing in it reads
 * `doc.versionId` in a typed position.
 */
describe('docType contributions', () => {
  it('adds nothing for a config whose features contribute nothing', () => {
    const plain = create('spec_doctype_pages', { fields: [text('title').isTitle()] });

    const contribution = contributionsFor(plain);

    expect(contribution.extends).toEqual([]);
    expect(contribution.members).toEqual([]);
    expect(contribution.fields(text('anything'))).toBe(true);
  });

  it('gives a versioned config the id of the version it was read as', () => {
    const versioned = create('spec_doctype_news', {
      versions: { draft: true },
      fields: [text('title').isTitle()]
    });

    expect(contributionsFor(versioned).members).toEqual(['versionId: string']);
  });

  it('intersects an upload config with UploadDoc, and asks codegen to import it', () => {
    const upload = create('spec_doctype_files', {
      upload: true,
      fields: [text('alt')]
    });

    const contribution = contributionsFor(upload);

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

    const contribution = contributionsFor(sized);

    expect(contribution.members).toEqual(['sizes:{thumbnail: string, sm: string, lg: string}']);
    // `sm` and `lg` are columns, and their type comes from the member above. Generating them from
    // their builders too would declare each twice.
    expect(contribution.fields(text('sm'))).toBe(false);
    expect(contribution.fields(text('lg'))).toBe(false);
    expect(contribution.fields(text('alt'))).toBe(true);
    // A field that is not a column of its own is generated as on any collection.
    expect(contribution.fields(blocks('sections', [block('caption').fields(text('text'))]))).toBe(
      true
    );
  });

  it('names one member per output format when a size has several', () => {
    const multi = create('spec_doctype_multi', {
      upload: { imageSizes: [{ name: 'hero', width: 800, out: ['webp', 'jpg'] }] },
      fields: [text('alt')]
    });

    expect(contributionsFor(multi).members).toEqual([
      'sizes:{thumbnail: string, hero_webp: string, hero_jpg: string}'
    ]);
  });

  it('lists every member of a config with upload and versions, upload first', () => {
    const both = create('spec_doctype_both', {
      versions: true,
      upload: { imageSizes: [{ name: 'sm', width: 100 }] },
      fields: [text('alt')]
    });

    const contribution = contributionsFor(both);

    expect(contribution.extends).toEqual(['UploadDoc']);
    expect(contribution.members).toEqual([
      'sizes:{thumbnail: string, sm: string}',
      'versionId: string'
    ]);
    expect(contribution.fields(text('sm'))).toBe(false);
  });

  it('gives a $url collection its address members, and a $url area its url only', () => {
    const page = create('spec_doctype_url', {
      $url: () => '/',
      fields: [text('title').isTitle()]
    });
    const settings = createArea('spec_doctype_url_area', {
      $url: () => '/',
      fields: [text('title').isTitle()]
    });

    expect(contributionsFor(page).members).toEqual([
      'url: string | null',
      '_urlPath: string | null',
      '_slug: string | null'
    ]);
    expect(contributionsFor(settings).members).toEqual(['url: string | null']);
  });
});
