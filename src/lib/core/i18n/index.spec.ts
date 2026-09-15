import { describe, expect, it, vi } from 'vitest';
import i18n, { createI18n, t__ } from './index.js';

describe('createI18n', () => {
  it('translates a namespaced key, with parameters', () => {
    const { t__ } = createI18n({ site: { hello: 'Hello $1, $2', more: 'more' } });
    expect(t__('site.more')).toBe('more');
    expect(t__('site.hello', 'Ada', 'welcome')).toBe('Hello Ada, welcome');
    expect(t__('site.hello', 'Ada')).toBe('Hello Ada, ');
  });

  it('picks a variant by the gender and plural modifiers', () => {
    const { t__ } = createI18n({ site: { saved: '{He|She|They|They} saved {it|it|them|them}' } });
    expect(t__('site.saved')).toBe('He saved it');
    expect(t__('site.saved|f')).toBe('She saved it');
    expect(t__('site.saved|m|p')).toBe('They saved them');
  });

  it('returns a key it has nothing for, as is', () => {
    const { t__ } = createI18n({ site: { more: 'more' } });
    expect(t__('shop.more')).toBe('shop.more');
    expect(t__('site.less')).toBe('site.less');
    expect(t__('more')).toBe('more');
  });

  it('reads a function on every call', () => {
    let dictionaries = { site: { more: 'more' } };
    const { t__ } = createI18n(() => dictionaries);
    expect(t__('site.more')).toBe('more');
    dictionaries = { site: { more: 'découvrir' } };
    expect(t__('site.more')).toBe('découvrir');
  });

  it('shares nothing between two translators', () => {
    const fr = createI18n({ site: { more: 'découvrir' } });
    const en = createI18n({ site: { more: 'more' } });
    expect(fr.t__('site.more')).toBe('découvrir');
    expect(en.t__('site.more')).toBe('more');
  });
});

describe("the panel's i18n", () => {
  it('translates what init loaded, and warns on a panel namespace it has not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    i18n.init({ common: { doc_updated: 'Document updated' } });
    expect(t__('common.doc_updated')).toBe('Document updated');
    expect(warn).not.toHaveBeenCalled();

    expect(t__('errors.generic')).toBe('errors.generic');
    expect(warn).toHaveBeenCalledWith('Namespace errors not loaded');
    warn.mockRestore();
  });

  it('is not what createI18n hands out', () => {
    i18n.init({ common: { more: 'panel' } });
    const app = createI18n({ common: { more: 'site' } });
    expect(app.t__('common.more')).toBe('site');
    expect(t__('common.more')).toBe('panel');
  });
});
