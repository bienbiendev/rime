import { applyAction } from '$app/forms';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { FormField } from '$lib/fields/types.js';
import { getValueAtPath } from '$lib/util/object.js';
import { snapshot } from '$lib/util/state.js';
import type { Dic } from '$lib/util/types.js';
import type { SubmitFunction } from '@sveltejs/kit';
import { diff } from 'deep-object-diff';
import { getContext, setContext } from 'svelte';
import { setErrorsContext } from './errors.svelte';

function createFormStore(initial: Dic, key: string) {
  //
  const errors = setErrorsContext(key);

  let form = $state(initial);
  const changes = $derived<Dic>(diff(initial, form));
  const hasError = $derived(errors.length);
  const canSubmit = $derived(Object.keys(changes).length > 0 && !hasError);
  let status = $state<number>();
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
   * const form = getDocumentFormContext()
   * const initialValue = form.getRawValue('blocks.0.title')
   *
   * // value will not update if doc.blocks.0.title update
   */
  function getRawValue<T>(path: string) {
    return (snapshot(getValueAtPath(path, form)) as T) || null;
  }

  function setValue(path: string, value: any) {
    status = undefined;
    form = { ...form, [path]: value };
  }

  function useField(path: string | undefined, config: FormFieldBuilder<FormField>) {
    path = path || config.name;
    //
    const validate = (value: any) => {
      let isEmpty;
      try {
        isEmpty = config.run.isEmpty(value);
      } catch (err: any) {
        console.error(err.message);
        throw new Error(config.type + ' ' + err.message);
      }
      if (config.get.required && isEmpty) {
        errors.value[path] = 'required::required_field';
        return false;
      }

      const validated = config.run.validate(value, {
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
        return config.run.condition(form, {});
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
      status = result.status;
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

    get error() {
      return errors;
    },

    get values() {
      return form;
    },

    get changes() {
      return changes;
    },

    get status() {
      return status;
    }
  };
}

export function setFormContext(initial: Dic, key: string) {
  const store = createFormStore(initial, key);
  return setContext(key, store);
}

export function getFormContext(key: string) {
  return getContext<FormContext>(key);
}

export type FormContext = ReturnType<typeof setFormContext>;
