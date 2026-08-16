<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { Input } from '$lib/panel/components/ui/input/index.js';
  import { capitalize } from '$lib/util/string.js';
  import type { TextFieldProps } from './props.js';

  const { path, config, type = 'text', form, icon: Icon }: TextFieldProps = $props();
  const field = $derived(form.useField(path || config.name, config));

  const onInput = (event: Event) => {
    field.value = (event.target as HTMLInputElement).value;
  };
</script>

<fieldset
  class="rz-text-field {config.raw.className || ''}"
  class:rz-text-field--with-icon={!!Icon}
  data-compact={config.raw.layout === 'compact' ? '' : null}
  use:fieldset={field}
>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-text-field__input-wrapper">
    <Input
      id={path || config.name}
      icon={Icon}
      autocomplete="off"
      name={path || config.name}
      placeholder={config.raw.placeholder || capitalize(config.raw.name)}
      data-error={field.error ? '' : null}
      {type}
      value={field.value}
      oninput={onInput}
    />
  </div>
  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  .rz-text-field[data-compact] :global {
    .rz-label {
      display: none;
    }
    .rz-field-error {
      top: var(--rz-size-1);
      right: var(--rz-size-1);
    }
    .rz-input {
      font-size: var(--rz-text-md);
    }
  }

  .rz-text-field--with-icon {
    .rz-text-field__input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      :global(.rz-button) {
        position: absolute;
        right: var(--rz-size-1-5);
        top: var(--rz-size-1-5);
      }
    }
  }
</style>
