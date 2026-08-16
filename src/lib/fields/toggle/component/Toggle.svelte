<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import { Switch } from '$lib/panel/components/ui/switch/index.js';
  import { slugify } from '$lib/util/string.js';
  import type { ToggleProps } from './props.js';

  const { path, config, form }: ToggleProps = $props();
  const field = $derived(form.useField<boolean>(path, config));
  const inputId = $derived(slugify(`${form.key}-${path}`));

  const onCheckedChange = (bool: boolean) => {
    field.value = bool;
  };
</script>

<fieldset class="rz-toggle-field {config.raw.className || ''}" use:fieldset={field}>
  <div class="rz-toggle-field-wrap">
    <Switch
      data-error={field.error ? '' : null}
      checked={field.value}
      {onCheckedChange}
      id={inputId}
    />
    <Field.LabelFor {config} for={inputId} />
  </div>
  <Field.Hint {config} />
</fieldset>

<style lang="postcss">
  .rz-toggle-field-wrap {
    display: flex;
    align-items: center;
  }

  .rz-toggle-field-wrap > :global(* + *) {
    margin-left: var(--rz-size-2);
  }

  .rz-toggle-field {
    margin-block: var(--rz-size-3);
  }

  .rz-toggle-field :global {
    .rz-field-hint {
      margin-left: var(--rz-size-8);
    }
  }
</style>
