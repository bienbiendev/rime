<script lang="ts">
  import { fieldset } from '#lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '#lib/panel/components/fields/index.js';
  import { Input } from '#lib/panel/components/ui/input/index.js';
  import Mail from '@lucide/svelte/icons/mail';
  import type { EmailFieldProps } from './props';

  const { path, config, form }: EmailFieldProps = $props();

  const field = $derived(form.useField(path || config.name, config));
  /** While the user types, the error waits for the blur: a half-typed address is not wrong yet. */
  let typing = $state(false);

  const onInput = (event: Event) => {
    typing = true;
    field.value = (event.target as HTMLInputElement).value;
  };

  const onBlur = () => {
    typing = false;
  };

  const error = $derived(!typing && field.error);
</script>

<fieldset
  data-compact={config.get.layout === 'compact' ? '' : null}
  class="{config.get.className} rz-email-field"
  use:fieldset={field}
>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-email-field-wrapper">
    <Input
      icon={Mail}
      id={path || config.name}
      name={path || config.name}
      autocomplete="off"
      placeholder={config.get.placeholder || config.get.label}
      data-error={error ? '' : null}
      value={field.value}
      onblur={onBlur}
      oninput={onInput}
    />
  </div>
  <Field.Hint {config} />
  <Field.Error {error} />
</fieldset>

<style>
  .rz-email-field[data-compact] :global {
    label {
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

  .rz-email-field-wrapper {
    position: relative;
    display: flex;
    align-items: center;

    :global(.rz-button) {
      position: absolute;
      right: var(--rz-size-1-5);
      top: var(--rz-size-1-5);
    }
  }
</style>
