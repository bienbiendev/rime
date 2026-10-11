import type { ConfigContext } from '#lib/core/config/context.server.js';
import type { Dic } from '#lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { expect, test, vi } from 'vitest';
import { knownLocale, requestLocale } from './request.server.js';

vi.mock('$app/env/private', () => ({ RIME_PANEL_ROUTE: 'panel' }));
vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com' }));
vi.mock('$app/state', () => ({ page: { params: {} } }));

const config = {
  isValidLocale: (code: string) => ['fr', 'en'].includes(code),
  getDefaultLocale: () => 'fr'
} as unknown as ConfigContext;

const fakeEvent = (path: string, args: { params?: Dic; routeId?: string; cookie?: string } = {}) =>
  ({
    url: new URL(`https://site.com${path}`),
    params: args.params ?? {},
    route: { id: args.routeId ?? null },
    cookies: { get: () => args.cookie }
  }) as unknown as RequestEvent;

const panel = { params: { panel: 'panel' }, routeId: '/(rime)/[panel=panel]/[slug=collection]' };

test('/api reads ?locale= only', () => {
  expect(requestLocale(fakeEvent('/api/pages?locale=en'), config)).toBe('en');
  expect(requestLocale(fakeEvent('/api/pages', { cookie: 'en' }), config)).toBe('fr');
  expect(requestLocale(fakeEvent('/api/pages?locale=zz'), config)).toBe('fr');
});

test('the panel reads ?locale=, then its cookie', () => {
  const at = (path: string, cookie?: string) => fakeEvent(path, { ...panel, cookie });
  expect(requestLocale(at('/panel/pages?locale=en', 'fr'), config)).toBe('en');
  expect(requestLocale(at('/panel/pages', 'en'), config)).toBe('en');
  expect(requestLocale(at('/panel/pages?locale=zz', 'en'), config)).toBe('en');
  expect(requestLocale(at('/panel/pages'), config)).toBe('fr');
});

test('the site reads its route param only', () => {
  expect(requestLocale(fakeEvent('/en/about', { params: { locale: 'en' } }), config)).toBe('en');
  expect(requestLocale(fakeEvent('/about?locale=en', { cookie: 'en' }), config)).toBe('fr');
});

test('an unknown code reads as the default, as setLocale sets it', () => {
  expect(knownLocale(config, 'zz')).toBe('fr');
  expect(knownLocale(config, undefined)).toBe('fr');
  expect(knownLocale(config, 'zz', 'en')).toBe('en');
});
