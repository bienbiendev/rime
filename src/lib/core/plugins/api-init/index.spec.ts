import { RimeFormError } from '#lib/core/errors/index.js';
import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: true }));

const { validateForm } = await import('./index.server.js');

describe('validateForm', () => {
  test('a weak password is filed under password, with what is wrong', () => {
    expect(() => validateForm({ email: 'a@b.co', name: 'Ada', password: 'abc' })).toThrow(
      expect.objectContaining({ errors: { password: RimeFormError.PASSWORD_MIN_8 } })
    );
  });

  test('a missing password is required', () => {
    expect(() => validateForm({ email: 'a@b.co', name: 'Ada' })).toThrow(
      expect.objectContaining({ errors: { password: RimeFormError.REQUIRED_FIELD } })
    );
  });
});
