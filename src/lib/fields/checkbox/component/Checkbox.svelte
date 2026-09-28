<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import '$lib/panel/components/fields/setting.css';
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

<!-- A row of a card: the name and the hint, then the box. -->
<fieldset class="rz-checkbox-field rz-setting {config.get.className || ''}" use:fieldset={field}>
  <div class="rz-setting__row">
    <div class="rz-setting__text">
      <Field.LabelFor {config} for={inputId} />
      <Field.Hint {config} />
    </div>
    <Checkbox
      class="rz-checkbox-field__input {checkboxErrorClass}"
      checked={field.value}
      {onCheckedChange}
      id={inputId}
    />
  </div>
</fieldset>

<style lang="postcss">
  .rz-checkbox-field :global(.rz-checkbox--error) {
    border-color: var(--rz-danger);
    background-color: var(--rz-danger);
  }
</style>
