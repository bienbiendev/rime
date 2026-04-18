<script lang="ts">
  import type { FormField, SimplerField } from '$lib/fields/types.js';

  type Props = { config: SimplerField<FormField> };
  const { config }: Props = $props();
</script>

{#if config.hint}
  <p class="rz-field-hint">
    {config.hint}
  </p>
{/if}

<style type="postcss">
  .rz-field-hint {
    opacity: 0.5;
    max-width: 320px;
    margin-top: var(--rz-size-1-5);
    font-size: var(--rz-text-sm);
  }
</style>
