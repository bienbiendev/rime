import i18n from '#lib/core/i18n/index.js';
import errors from '#lib/core/i18n/en/errors.js';
import { describe, expect, test } from 'vitest';
import { RimeFormError } from './index.js';

i18n.init({ errors });

describe('RimeFormError', () => {
  test('reads each field error as the panel shows it', () => {
    const error = new RimeFormError({
      title: 'required_field',
      link: 'url::invalid_url',
      name: 'Starts with a capital'
    });

    expect(error.message).toBe(
      'form_error — title: Required, link: Invalid URL, name: Starts with a capital'
    );
  });
});
