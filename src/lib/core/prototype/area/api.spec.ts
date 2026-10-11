import { describe, expect, it, vi } from 'vitest';
import { areaApi } from './api.server.js';
import { update } from './operations/update.js';

vi.mock('./operations/update.js', () => ({ update: vi.fn(async () => ({})) }));

describe('areaApi.update', () => {
  it('hands every argument to the operation, isLocaleCopy included', async () => {
    const event = { locals: { locale: 'en' } } as any;
    await areaApi({ config: { slug: 'infos' } as any, event, defaultLocale: 'en' }).update({
      data: {},
      versionId: 'v2',
      isLocaleCopy: true
    } as any);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ isLocaleCopy: true, versionId: 'v2', locale: 'en' })
    );
  });
});
