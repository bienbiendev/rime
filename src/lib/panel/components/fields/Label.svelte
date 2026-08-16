<script lang="ts">
  import type { FormFieldBuilder } from '$lib/fields/index.js';
  import type { FormField } from '$lib/fields/types.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { capitalize } from '$lib/util/string.js';
  import type { Snippet } from 'svelte';
  import { Label } from '../ui/label/index.js';

  type Props = { config: FormFieldBuilder<FormField>; children?: Snippet; for?: string };
  const { config, children, for: forAttribute, ...rest }: Props = $props();

  const locale = getLocaleContext();
</script>

<Label class="rz-field-label" title={config.__label} for={forAttribute || null} {...rest}>
  {#if config}
    {config.__label || capitalize(config.name)}
    {#if config.__localized}
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
