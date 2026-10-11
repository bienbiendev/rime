import { applyAction } from '$app/forms';
import type { FormFieldBuilder } from '#lib/core/fields/builders/form-field-builder.js';
import type { FormField } from '#lib/fields/types.js';
import { getValueAtPath } from '#lib/util/object.js';
import { snapshot } from '#lib/util/state.js';
import type { Dic } from '#lib/util/types.js';
import type { SubmitFunction } from '$app/forms';
import { diff } from 'deep-object-diff';
import { createErrorsStore } from './errors.svelte';

export function createFormStore(initial: Dic) {
  const errors = createErrorsStore();

  let form = $state(initial);
  const changes = $derived<Dic>(diff(initial, form));
  const hasError = $derived(errors.length);
  const canSubmit = $derived(Object.keys(changes).length > 0 && !hasError);
  let pending = $state(false);

  $effect(() => {
    if (Object.keys(changes).length) {
      errors.value = {};
    }
  });

  /**
   * Function that return an unreactive snapshot of a value given a path.
   *
   * @param path Field path ex: blocks.0.title
   * @returns an unreactive snapshot
   *
   * @example
   * const initialValue = form.getRawValue('blocks.0.title')
   *
   * // value will not update if doc.blocks.0.title update
   */
  function getRawValue<T>(path: string) {
    return (snapshot(getValueAtPath(path, form)) as T) || null;
  }

  function setValue(path: string, value: any) {
    form = { ...form, [path]: value };
  }

  function useField(path: string | undefined, config: FormFieldBuilder<FormField>) {
    path = path || config.name;
    const validate = (value: any) => {
      let isEmpty;
      try {
        isEmpty = config.use.isEmpty(value);
      } catch (err: any) {
        console.error(err.message);
        throw new Error(config.type + ' ' + err.message);
      }
      if (config.get.required && isEmpty) {
        errors.value[path] = 'required::required_field';
        return false;
      }

      const validated = config.use.validate(value, {
        data: form,
        id: undefined,
        operation: undefined,
        user: undefined,
        locale: undefined,
        config: config.get
      });

      if (validated !== true) {
        errors.value[path] = validated;
        return false;
      }

      if (errors.has(path)) {
        errors.delete(path);
      }

      return true;
    };

    return {
      path,

      get value() {
        return form[path];
      },

      get editable() {
        return true;
      },

      set value(value: any) {
        const valid = validate(value);

        if (valid) {
          setValue(path, value);
        }
      },

      get visible() {
        return config.use.isVisible(form, {});
      },

      get error() {
        return errors.value[path] || false;
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
          if (result.data?.error) {
            errors.value = result.data.errors;
          }
          form = result.data?.form || {};
          initial = form;
          break;
        case 'redirect':
          await applyAction(result);
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
