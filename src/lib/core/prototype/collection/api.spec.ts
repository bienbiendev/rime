import { describe, expect, it, vi } from 'vitest';
import { collectionApi } from './api.server.js';
import { deleteDocs } from './operations/delete.js';

vi.mock('./operations/delete.js', () => ({ deleteDocs: vi.fn(async () => []) }));

describe('collectionApi.delete', () => {
  it("runs in the request's locale when it names none, as every other method does", async () => {
    const event = { locals: { locale: 'fr' } } as any;
    await collectionApi({ config: { slug: 'pages' } as any, event, defaultLocale: 'en' }).delete();
    expect(deleteDocs).toHaveBeenCalledWith(expect.objectContaining({ locale: 'fr' }));
  });
});
