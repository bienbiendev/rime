import { RimeFormError } from '#lib/core/errors/index.js';
import {
  confirmPasswordField,
  emailField,
  newPasswordField,
  passwordField
} from '#lib/panel/pages/auth/fields.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ applyAction: vi.fn() }));
const { createFormStore } = await import('./form.svelte.js');

describe('createFormStore', () => {
  it('keeps an invalid value and its error while another field changes', () => {
    const form = createFormStore({});
    const email = form.useField(undefined, emailField());
    const password = form.useField(undefined, passwordField());

    email.value = 'admin@site.com';
    email.value = 'a@b';
    password.value = 'secret';

    expect(form.values.email).toBe('a@b');
    expect(email.error).toBeTruthy();
    expect(form.canSubmit).toBe(false);
  });

  it('checks a confirmation typed first again once the password is typed', () => {
    const form = createFormStore({});
    const password = form.useField(undefined, newPasswordField());
    const confirm = form.useField(undefined, confirmPasswordField());

    confirm.value = 'Secret-123!';
    expect(confirm.error).toBe(RimeFormError.PASSWORD_MISMATCH);

    password.value = 'Secret-123!';
    expect(confirm.error).toBe(false);
    expect(form.canSubmit).toBe(true);

    confirm.value = 'Secret-124!';
    expect(confirm.error).toBe(RimeFormError.PASSWORD_MISMATCH);
    expect(form.canSubmit).toBe(false);
  });
});
