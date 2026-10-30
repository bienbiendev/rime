import i18n from '#lib/core/i18n/index.js';
import errors from '#lib/core/i18n/en/errors.js';
import { describe, expect, test } from 'vitest';
import { errorText } from './error-text.js';

i18n.init({ errors });

describe('errorText', () => {
  test('a rime code is translated, after its `::` prefix', () => {
    expect(errorText('required::required_field')).toBe('Required');
    expect(errorText('url::invalid_url')).toBe('Invalid URL');
    expect(errorText('email::invalid_email')).toBe('Invalid email address');
  });

  test("a validator's own message is shown as is", () => {
    expect(errorText('Starts with a capital')).toBe('Starts with a capital');
    expect(errorText('Format HH::MM')).toBe('Format HH::MM');
  });
});
