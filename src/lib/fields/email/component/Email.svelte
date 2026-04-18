<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { Input } from '$lib/panel/components/ui/input/index.js';
  import { capitalize } from '$lib/util/string.js';
  import { Mail } from '@lucide/svelte';
  import type { EmailFieldProps } from './props';

  const { path, config, form }: EmailFieldProps = $props();

  const field = $derived(form.useField(path || config.name, config));
  let showError = $state(false);

  // Actions
  const onInput = (event: Event) => {
    showError = false;
    field.value = (event.target as HTMLInputElement).value;
  };

  const onBlur = () => {
    showError = true;
  };
</script>

<fieldset
  data-compact={config.layout === 'compact' ? '' : null}
  class="{config.className} rz-email-field"
  use:root={field}
>
  <Field.Label {config} for={path || config.name} />
  <div class="rz-email-field-wrapper">
    <Input
      icon={Mail}
      id={path || config.name}
      name={path || config.name}
      autocomplete="off"
      placeholder={config.placeholder || capitalize(config.label || config.name)}
      data-error={showError && field.error ? '' : null}
      value={field.value}
      onblur={onBlur}
      oninput={onInput}
    />
  </div>
  <Field.Hint {config} />
  <Field.Error error={(showError && field.error) || false} />
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
