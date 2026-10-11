import { describe, expect, it, vi } from 'vitest';
import { richText } from './index.js';
import { duplicateRichText, populateReferences } from './module.server.js';

const contextFor = (field: ReturnType<typeof richText>) => ({ config: field.get }) as any;

const heading = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Sale', marks: [{ type: 'bold' }] }]
    }
  ]
};

describe('duplicateRichText', () => {
  it('gives a title a (copy) text node, its heading and marks kept', () => {
    expect(duplicateRichText(heading, contextFor(richText('heading').isTitle()))).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'text', text: 'Sale', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' (copy)' }
          ]
        }
      ]
    });
  });

  it('gives a plain-string title (copy) as text', () => {
    expect(duplicateRichText('Sale', contextFor(richText('heading').isTitle()))).toBe(
      'Sale (copy)'
    );
  });

  it('leaves a title with no text, and a field that is not the title', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(duplicateRichText(empty, contextFor(richText('heading').isTitle()))).toBe(empty);
    expect(duplicateRichText(null, contextFor(richText('heading').isTitle()))).toBe(null);
    expect(duplicateRichText(heading, contextFor(richText('body')))).toBe(heading);
  });
});

describe('populateReferences', () => {
  const sea = {
    id: 'm1',
    url: '/uploads/medias/sea.jpg',
    sizes: { thumbnail: '/uploads/medias/sea-thumbnail-400.jpg' },
    title: 'sea.jpg',
    mimeType: 'image/jpeg',
    filename: 'sea.jpg'
  };
  const about = { id: 'p1', title: 'About', _thumbnail: '/uploads/medias/about.jpg' };
  const noMedia = { url: null, sizes: null, title: null, mimeType: null, filename: null };
  const noPage = { title: null, _type: null, _thumbnail: null };

  const configs: Record<string, object> = {
    medias: { asTitle: 'filename', upload: { imageSizes: [{ name: 'thumbnail' }] } },
    pages: { asTitle: 'attributes.title', asThumbnail: 'cover' },
    docs: { asTitle: 'title' }
  };

  /** A read of `value` by a caller who may read the documents in `readable`, and nothing else. */
  const read = async (value: unknown, readable: Record<string, any[]>, system = false) => {
    const findByIds = vi.fn(async ({ ids }: { ids: string[]; select: string[] }, slug: string) =>
      (readable[slug] ?? []).filter((doc) => ids.includes(doc.id))
    );
    const rime = {
      config: {
        isCollection: (slug: string) => slug in configs,
        getCollection: (slug: string) => configs[slug]
      },
      collection: (slug: string) => ({
        system: (asSystem: boolean) => ({
          findByIds: (args: { ids: string[]; select: string[] }) => {
            expect(asSystem).toBe(system);
            return findByIds(args, slug);
          }
        })
      })
    };
    const context = { event: { locals: { rime } }, operation: { isSystemOperation: system } };
    return { result: await populateReferences(value, context as any), findByIds };
  };

  const upload = (slug: string, attrs: object) => ({ type: `rich-text-upload-${slug}`, attrs });
  const resource = (slug: string, attrs: object) => ({
    type: `rich-text-resource-${slug}`,
    attrs
  });

  it('fills an upload node from its media as it is now, its legend kept', async () => {
    const value = { type: 'doc', content: [upload('medias', { id: 'm1', legend: 'Sea' })] };
    const { result } = await read(value, { medias: [sea] });
    const { id, ...derived } = sea;
    expect(result.content[0].attrs).toEqual({ id, legend: 'Sea', ...derived });
  });

  it('fills a resource node from its document, its collection as `_type`', async () => {
    const value = { type: 'doc', content: [resource('pages', { id: 'p1' })] };
    const { result } = await read(value, { pages: [about] });
    expect(result.content[0].attrs).toEqual({ ...about, _type: 'pages' });
  });

  it('fills a missing or unreadable document with null, and replaces what a node stored', async () => {
    const value = {
      type: 'doc',
      content: [
        upload('medias', { id: 'gone', url: '/medias/gone.jpg' }),
        upload('docs', { id: 'secret', url: '/medias/secret.pdf' }),
        resource('pages', { id: 'private', title: 'Secret', _type: 'pages', _thumbnail: '/a.jpg' })
      ]
    };
    const { result } = await read(value, { medias: [sea] });
    expect(result.content[0].attrs).toEqual({ id: 'gone', ...noMedia });
    expect(result.content[1].attrs).toEqual({ id: 'secret', ...noMedia });
    expect(result.content[2].attrs).toEqual({ id: 'private', ...noPage });
  });

  it('fills a node at any depth, with one read per collection whatever the kinds', async () => {
    const value = {
      type: 'doc',
      content: [
        upload('medias', { id: 'm1' }),
        {
          type: 'blockquote',
          content: [
            { type: 'listItem', content: [upload('medias', { id: 'm1' })] },
            resource('medias', { id: 'm1' })
          ]
        }
      ]
    };
    const { result, findByIds } = await read(value, { medias: [sea] });
    expect(result.content[1].content[0].content[0].attrs.url).toBe(sea.url);
    expect(result.content[1].content[1].attrs).toMatchObject({ title: 'sea.jpg', _type: 'medias' });
    expect(findByIds).toHaveBeenCalledTimes(1);
    const [{ ids, select }] = findByIds.mock.calls[0];
    expect(ids).toEqual(['m1']);
    // What both kinds fill from, and no other field: no rich text of the media is read
    expect(new Set(select)).toEqual(
      new Set(['title', 'filename', 'mimeType', 'thumbnail', '_thumbnail'])
    );
  });

  it("selects a resource's title and thumbnail fields", async () => {
    const value = { type: 'doc', content: [resource('pages', { id: 'p1' })] };
    const { findByIds } = await read(value, { pages: [about] });
    expect(findByIds.mock.calls[0][0].select).toEqual([
      'title',
      'attributes.title',
      '_thumbnail',
      'cover'
    ]);
  });

  it('keeps a node with no id, and a value that is no document, as they are', async () => {
    const legacy = resource('pages', { title: 'Old', _type: 'pages' });
    const { result, findByIds } = await read({ type: 'doc', content: [legacy] }, {});
    expect(result.content[0]).toEqual(legacy);
    expect(findByIds).not.toHaveBeenCalled();

    expect((await read('plain text', {})).result).toBe('plain text');
  });

  it("reads the documents as rime on rime's own read", async () => {
    const value = { type: 'doc', content: [upload('medias', { id: 'm1' })] };
    const { result } = await read(value, { medias: [sea] }, true);
    expect(result.content[0].attrs.url).toBe(sea.url);
  });
});
