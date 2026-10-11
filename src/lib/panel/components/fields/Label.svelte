<script lang="ts">
  import type { FormFieldBuilder } from '#lib/fields/index.js';
  import type { FormField } from '#lib/fields/types.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import type { Snippet } from 'svelte';
  import { Label } from '../ui/label/index.js';

  type Props = { config: FormFieldBuilder<FormField>; children?: Snippet; for?: string };
  const { config, children, for: forAttribute }: Props = $props();

  const locale = getLocaleContext();
</script>

<Label class="rz-field-label" title={config.get.label} for={forAttribute || null}>
  {config.get.label}
  {#if config.get.localized}
    <sup>{locale.code}</sup>
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
      margin-left: var(--rz-size-0-5);
      color: var(--rz-fg-subtle);
      font-size: var(--rz-text-2xs);
      text-transform: uppercase;
    }
  }
</style>
