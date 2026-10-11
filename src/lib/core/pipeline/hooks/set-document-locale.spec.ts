import { describe, expect, test } from 'vitest';
import { setDocumentLocale } from './set-document-locale.server.js';

const run = (params: Record<string, unknown>, requestLocale?: string) =>
  setDocumentLocale({
    doc: { id: '1' },
    context: { params },
    event: { locals: { locale: requestLocale } }
  } as any);

describe('setDocumentLocale', () => {
  test('a read in a locale says that locale, whatever the request locale', async () => {
    const { doc } = await run({ locale: 'fr' }, 'en');
    expect(doc.locale).toBe('fr');
  });

  test('a read without a locale says the request locale', async () => {
    const { doc } = await run({}, 'en');
    expect(doc.locale).toBe('en');
  });

  test('a read in a locale, outside a request, says that locale', async () => {
    const { doc } = await run({ locale: 'fr' });
    expect(doc.locale).toBe('fr');
  });
});
