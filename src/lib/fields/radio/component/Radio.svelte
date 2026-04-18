<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { Label } from '$lib/panel/components/ui/label/index.js';
  import * as RadioGroup from '$lib/panel/components/ui/radio-group/index.js';
  import * as RadioRowGroup from '$lib/panel/components/ui/radio-row-group/index.js';
  import { capitalize, slugify } from '$lib/util/string.js';
  import type { RadioFieldProps } from './props.js';

  const { path, config, form }: RadioFieldProps = $props();
  const field = $derived(form.useField<string>(path, config));

  const fieldId = $derived(slugify(`${form.key}-${path}`));
</script>

<fieldset
  class="rz-field-radio rz-field-radio--{config.layout} {config.className || ''}"
  use:root={field}
>
  <Field.Label {config} for={path || config.name} />

  {#if config.layout === 'row'}
    <RadioRowGroup.Root bind:value={field.value} disabled={!field.editable}>
      {#each config.options as option, index (index)}
        <div class="rz-radio__option">
          <RadioRowGroup.Item value={option.value} id="{fieldId}-{index}" class="rz-radio__input">
            {option.label || capitalize(option.value)}
          </RadioRowGroup.Item>
        </div>
      {/each}
    </RadioRowGroup.Root>
  {:else}
    <RadioGroup.Root bind:value={field.value} class="rz-radio" disabled={!field.editable}>
      {#each config.options as option, index (index)}
        <div class="rz-radio__option">
          <RadioGroup.Item value={option.value} id="{fieldId}-{index}" class="rz-radio__input" />
          <Label class="rz-radio__label" for="{fieldId}-{index}">
            {option.label || capitalize(option.value)}
          </Label>
        </div>
      {/each}
    </RadioGroup.Root>
  {/if}

  <Field.Hint {config} />
  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  .rz-field-radio:not(.rz-field-radio--row) {
    display: flex;
    flex-direction: column;
    /*gap: var(--rz-size-2);*/

    :global {
      .rz-radio__input {
        margin-right: var(--rz-size-2);
      }
      .rz-radio__label {
        cursor: pointer;
      }
    }
    .rz-radio__option {
      display: flex;
      align-items: center;
    }
  }
</style>
