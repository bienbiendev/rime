<script lang="ts">
  import type { FormFieldBuilder } from '$lib/fields';
  import type { FormField } from '$lib/fields/types.js';

  type Props = { config: FormFieldBuilder<FormField> };
  const { config }: Props = $props();
</script>

{#if config.raw.hint}
  <p class="rz-field-hint">
    {config.raw.hint}
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
