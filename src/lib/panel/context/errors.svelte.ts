import type { FormErrors } from '#lib/panel/types.js';

/**
 * A form's errors, keyed by normalized field path. `length` counts the keys that hold an error;
 * `get` answers the error, or `false`.
 *
 * ```ts
 * { 'sections.2.title': 'required::required_field' }
 * ```
 */
export function createErrorsStore() {
  let errors: FormErrors = $state({});

  return {
    get length() {
      return Object.values(errors).filter(Boolean).length;
    },

    get value() {
      return errors;
    },

    set value(val) {
      errors = val;
    },

    has(key: string) {
      return !!(key in errors);
    },

    hasRequired(key: string) {
      return key in errors && errors[key].includes('required::');
    },

    get(key: string) {
      return key in errors && errors[key];
    },

    set(key: string, value: string) {
      errors[key] = value;
    },

    delete(key: string) {
      delete errors[key];
    },

    deleteAllThatStartWith(path: string) {
      for (const key of Object.keys(errors)) {
        if (key.startsWith(path)) {
          delete errors[key];
        }
      }
    }
  };
}
