import { text } from '#lib/fields/index.js';
import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { populateRessourceURL } from './module.server.js';

/** `pages`, titled by `attributes.title`; `settings`, an area with a title field; `infos`, one with none. */
const configs: Dic = {
  pages: { slug: 'pages', type: 'collection', asTitle: 'attributes.title', fields: [] },
  settings: {
    slug: 'settings',
    type: 'area',
    label: 'Settings',
    asTitle: 'name',
    fields: [text('name').isTitle()]
  },
  infos: { slug: 'infos', type: 'area', label: 'Infos', asTitle: 'id', fields: [text('email')] }
};

/** A rime whose reads answer each target's id, url and title, in a request whose locale is fr. */
const setup = (read: { findById?: () => Promise<Dic> } = {}) => {
  const findById = vi.fn(
    read.findById ??
      (async ({ id }: Dic) => ({ id, url: `https://site.test/${id}`, title: 'About' }))
  );
  const find = vi.fn(async () => ({ id: 'a1', url: 'https://site.test/en/about', title: 'Site' }));
  const system = vi.fn<(isSystem?: boolean) => Dic>(() => ({ findById, find }));
  const rime = {
    config: {
      getBySlug: (slug: string) => configs[slug],
      isArea: (slug: string) => configs[slug]?.type === 'area',
      isCollection: (slug: string) => configs[slug]?.type === 'collection'
    },
    collection: () => ({ system }),
    area: () => ({ system })
  };
  const run = (link: Dic, params: Dic = { locale: 'en' }, isSystemOperation = false) =>
    populateRessourceURL(
      link as any,
      {
        event: { locals: { rime, locale: 'fr' } },
        documentId: 'p1',
        operation: { params, isSystemOperation }
      } as any
    );
  return { run, findById, find, system };
};

const pageLink = { type: 'pages', value: 'p2', target: '_self' };

describe('populateRessourceURL', () => {
  it("gives a page link its target's id, url and title at depth 0, read in the read's locale", async () => {
    const { run, findById } = setup();
    const link = await run(pageLink);

    expect(findById).toHaveBeenCalledWith({
      id: 'p2',
      locale: 'en',
      select: ['url', 'title', 'attributes.title']
    });
    expect(link).toEqual({ ...pageLink, id: 'p2', url: 'https://site.test/p2', title: 'About' });
  });

  it('reads an area link with find, named by its title field', async () => {
    const { run, find } = setup();
    const link = await run({ type: 'settings', value: 'a1', target: '_self' });

    expect(find).toHaveBeenCalledWith({ locale: 'en', select: ['url', 'title', 'name'] });
    expect(link).toMatchObject({ id: 'a1', url: 'https://site.test/en/about', title: 'Site' });
  });

  it('names an area with no title field by its label', async () => {
    const { run } = setup();
    const link = await run({ type: 'infos', value: 'a1', target: '_self' });
    expect(link.title).toBe('Infos');
  });

  it('removes a stored id, url and title when the target is refused or missing', async () => {
    const { run } = setup({
      findById: async () => {
        throw new Error('unauthorized');
      }
    });
    const stored = { ...pageLink, id: 'p2', url: 'https://elsewhere.test', title: 'Elsewhere' };
    expect(await run(stored)).toEqual(pageLink);
  });

  it('gives no url when the target has none', async () => {
    const { run } = setup({ findById: async () => ({ id: 'p2', title: 'About' }) });
    expect(await run(pageLink)).toEqual(pageLink);
  });

  it('reads a link to its own document like any other', async () => {
    const { run, findById } = setup();
    const link = await run({ ...pageLink, value: 'p1' });
    expect(findById).toHaveBeenCalledOnce();
    expect(link.url).toBe('https://site.test/p1');
  });

  it('reads as rime in a system read', async () => {
    const { run, system } = setup();
    await run(pageLink, { locale: 'en' }, true);
    expect(system).toHaveBeenCalledWith(true);
  });

  it('returns a url link as stored, and reads nothing', async () => {
    const { run, findById, find } = setup();
    const stored = {
      type: 'url',
      value: 'https://a.test',
      target: '_blank',
      url: 'https://a.test'
    };
    expect(await run(stored)).toBe(stored);
    expect(findById).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
});
