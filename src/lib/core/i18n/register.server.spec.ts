import { describe, expect, it, onTestFinished, vi } from 'vitest';
import en from './en/common.js';
import { registerTranslation } from './register.server.js';

// The French fields texts fail to load
vi.mock('./fr/fields.js', () => {
  throw new Error('broken module');
});

/** console.error, silenced for the test and read back. */
const consoleError = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  onTestFinished(() => spy.mockRestore());
  return spy;
};

describe('registerTranslation', () => {
  it('reads English for a language rime has no texts for, and names it', async () => {
    const error = consoleError();
    const dictionaries = await registerTranslation('FR' as never);

    expect(dictionaries.common).toEqual(en);
    expect(Object.keys(dictionaries).sort()).toEqual(['common', 'errors', 'fields', 'mail']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"FR"'));
  });

  it('keeps the namespaces that load when one fails', async () => {
    consoleError();
    const dictionaries = await registerTranslation('fr');

    expect(Object.keys(dictionaries).sort()).toEqual(['common', 'errors', 'mail']);
  });
});
