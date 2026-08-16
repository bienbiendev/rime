<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { Checkbox } from '$lib/panel/components/ui/checkbox/index.js';
  import { slugify } from '$lib/util/string.js';
  import type { CheckboxProps } from './props';

  const { path, config, form }: CheckboxProps = $props();

  const field = $derived(form.useField<boolean>(path, config));

  const onCheckedChange = (bool: boolean) => {
    field.value = bool;
  };

  const checkboxErrorClass = $derived(field.error ? 'rz-checkbox--error' : '');
  const inputId = $derived(`${form.key}-${slugify(path)}`);
</script>

<fieldset class="rz-checkbox-field {config.raw.className || ''}" use:fieldset={field}>
  <div>
    <Checkbox
      class="rz-checkbox-field__input {checkboxErrorClass}"
      checked={field.value}
      {onCheckedChange}
      id={inputId}
    />
    <Field.LabelFor {config} for={inputId} />
  </div>
  <Field.Hint {config} />
</fieldset>

<style lang="postcss">
  .rz-checkbox-field {
    margin-top: var(--rz-size-3);
    margin-bottom: var(--rz-size-3);

    :global {
      .rz-field-hint {
        margin-left: var(--rz-size-7);
      }
    }
  }

  .rz-checkbox-field > div {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
  }

  :global {
    .rz-render-fields__field[data-type='checkbox']
      + .rz-render-fields__field[data-type='checkbox'] {
      .rz-checkbox-field {
        margin-top: 0;
      }
    }
  }

  .rz-checkbox-field__input {
    width: var(--rz-size-5);
    height: var(--rz-size-5);
  }

  .rz-checkbox--error {
    background-color: hsl(var(--rz-color-alert));
  }
</style>
