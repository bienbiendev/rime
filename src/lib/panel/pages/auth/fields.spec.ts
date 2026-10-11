import { RimeFormError } from '#lib/core/errors/index.js';
import { describe, expect, test } from 'vitest';
import { confirmPasswordField, emailField, newPasswordField, passwordField } from './fields.js';

describe('auth fields', () => {
  test('a confirmation that differs from the password is refused', () => {
    const confirm = confirmPasswordField();
    const metas = { data: { password: 'Abc12345!' } } as never;
    expect(confirm.use.validate('xyz', metas)).toBe(RimeFormError.PASSWORD_MISMATCH);
    expect(confirm.use.validate('Abc12345!', metas)).toBe(true);
  });

  test('a new password is as strong as validate.password asks', () => {
    expect(newPasswordField().use.validate('abc', {} as never)).toBe(RimeFormError.PASSWORD_MIN_8);
    expect(newPasswordField().use.validate('Abc12345!', {} as never)).toBe(true);
  });

  test('an email is checked', () => {
    expect(emailField().use.validate('a@b.co', {} as never)).toBe(true);
    expect(emailField().use.validate('a@b', {} as never)).toBe(RimeFormError.INVALID_EMAIL);
  });

  test('each caller gets its own builder', () => {
    newPasswordField().placeholder('New password');
    passwordField().placeholder('New password');
    expect(passwordField().get.placeholder).toBeUndefined();
  });
});
