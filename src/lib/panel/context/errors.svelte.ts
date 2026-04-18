import type { FormErrors } from '$lib/panel/types.js';
import { getContext, setContext } from 'svelte';

function createErrorsStore() {
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

    get first() {
      return Object.values(errors)[0];
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
      const basePath = path.replace('*', '');
      for (const key of Object.keys(errors)) {
        if (key.startsWith(basePath)) {
          delete errors[key];
        }
      }
    }
  };
}

const ERRORS_KEY = 'rime.errors';

export function setErrorsContext(key: string = 'root') {
  const errors = createErrorsStore();
  return setContext(`${ERRORS_KEY}.${key}`, errors);
}

export function getErrorsContext(key: string = 'root') {
  return getContext<ReturnType<typeof setErrorsContext>>(`${ERRORS_KEY}.${key}`);
}
