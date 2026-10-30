import { applyAction } from '$app/forms';
import { errorText } from '#lib/core/errors/index.js';
import type { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import { t__ } from '#lib/core/i18n/index.js';
import type { FormField } from '#lib/fields/types.js';
import type { FormErrors } from '#lib/panel/types.js';
import { getValueAtPath } from '#lib/util/object.js';
import { snapshot } from '#lib/util/state.js';
import type { Dic } from '#lib/util/types.js';
import type { SubmitFunction } from '$app/forms';
import { diff } from 'deep-object-diff';
import { toast } from 'svelte-sonner';
import { createErrorsStore } from './errors.svelte';

/**
 * The store of the small forms outside a document: sign-in, forgot and reset password, and a
 * rich-text node's fields. Values are flat, one key per field (`setValue('email', …)`), and kept
 * as typed, valid or not: each change checks every field again, so an error stays on its field
 * until its value is valid, and Save stays off while one is not.
 */
export function createFormStore(initial: Dic) {
  const errors = createErrorsStore();

  let form = $state(initial);
  const changes = $derived<Dic>(diff(initial, form));
  const hasError = $derived(errors.length);
  const canSubmit = $derived(Object.keys(changes).length > 0 && !hasError);
  let pending = $state(false);

  /** Each field's check, by path: `true`, or the error code of its value. */
  const checks: Record<string, (value: unknown) => true | string> = {};

  /** Every field's error, from the values as they are: a field nobody typed in has none. */
  function checkAll() {
    const next: FormErrors = {};
    for (const [path, check] of Object.entries(checks)) {
      if (form[path] === undefined) continue;
      const result = check(form[path]);
      if (result !== true) next[path] = result;
    }
    errors.value = next;
  }

  /** The value at `path` as it is now, a copy that does not follow changes; `null` if falsy. */
  function getRawValue<T>(path: string) {
    return (snapshot(getValueAtPath(path, form)) as T) || null;
  }

  function setValue(path: string, value: any) {
    form = { ...form, [path]: value };
  }

  function useField(path: string | undefined, config: FormFieldBuilder<FormField>) {
    const key = path || config.name;
    checks[key] = (value) => {
      let isEmpty;
      try {
        isEmpty = config.use.isEmpty(value);
      } catch (err: any) {
        console.error(err.message);
        throw new Error(config.type + ' ' + err.message);
      }
      if (config.get.required && isEmpty) return 'required::required_field';

      return config.use.validate(value, {
        data: form,
        id: undefined,
        operation: undefined,
        user: undefined,
        locale: undefined,
        config: config.get
      });
    };

    return {
      path: key,

      get value() {
        return form[key];
      },

      get editable() {
        return true;
      },

      set value(value: any) {
        setValue(key, value);
        checkAll();
      },

      get visible() {
        return config.use.isVisible(form, {});
      },

      get error() {
        return errors.value[key] || false;
      }
    };
  }

  const enhance: SubmitFunction = async ({ formData }) => {
    pending = true;

    for (const key of Object.keys(form)) {
      formData.set(key, form[key]);
    }

    return async ({ result }) => {
      pending = false;

      switch (result.type) {
        case 'failure':
          if (result.data?.errors) {
            errors.value = result.data.errors;
          }
          form = result.data?.form || {};
          initial = form;
          break;
        case 'redirect':
          await applyAction(result);
          break;
        // A `RimeError` out of the action arrives with its message; a 5xx carries its code alone
        case 'error':
          toast.error(errorText(result.error?.message ?? '') || t__('common.generic_error'));
          break;
      }
    };
  };

  return {
    setValue,
    useField,
    readOnly: false,
    enhance,
    getRawValue,

    get pending() {
      return pending;
    },

    get canSubmit() {
      return canSubmit;
    },

    get errors() {
      return errors;
    },

    get values() {
      return form;
    },

    get changes() {
      return changes;
    }
  };
}

export type FormContext = ReturnType<typeof createFormStore>;
