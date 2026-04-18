<script lang="ts">
  import type { FormField, SimplerField } from '$lib/fields/types.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { capitalize } from '$lib/util/string.js';
  import type { Snippet } from 'svelte';
  import { Label } from '../ui/label/index.js';

  type Props = { config?: SimplerField<FormField>; children?: Snippet; for?: string };
  const { config, children, for: forAttribute, ...rest }: Props = $props();

  const locale = getLocaleContext();
</script>

<Label
  class="rz-field-label"
  title={config?.label ? config.name : null}
  for={forAttribute || null}
  {...rest}
>
  {#if config}
    {config.label || capitalize(config.name)}
    {#if config.localized}
      <sup>{locale.code}</sup>
    {/if}
  {/if}
  {@render children?.()}
</Label>

<style type="postcss">
  :global {
    .rz-field-label {
      margin-bottom: var(--rz-size-2);
      display: block;
    }
    .rz-field-label sup {
      font-size: var(--rz-text-2xs);
      text-transform: uppercase;
    }
  }
</style>
