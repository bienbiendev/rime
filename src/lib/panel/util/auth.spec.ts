import i18n from '#lib/core/i18n/index.js';
import common from '#lib/core/i18n/en/common.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com' }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));
const { authRequest } = await import('./auth.js');

i18n.init({ common });

describe('authRequest', () => {
  beforeEach(() => toast.error.mockClear());

  it('answers the data of a request that succeeds', async () => {
    expect(await authRequest(async () => ({ data: { status: true }, error: null }))).toEqual({
      status: true
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says an invalid reset link is invalid, in the panel language', async () => {
    const answer = await authRequest(async () => ({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
    }));
    expect(answer).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('This reset link is invalid or has expired');
  });

  it('answers null with the generic error for another error, or a network failure', async () => {
    await authRequest(async () => ({ data: null, error: { code: 'TOO_MANY_REQUESTS' } }));
    await authRequest(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(toast.error.mock.calls).toEqual([['An error occurred'], ['An error occurred']]);
  });
});
