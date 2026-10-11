<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';

  const { value }: { value: unknown[] | null } = $props();

  const count = $derived(value?.length ?? 0);
</script>

<div class="rz-blocks-cell">
  {count === 1 ? t__('fields.blocks_count', '1') : t__('fields.blocks_count|m|p', String(count))}
</div>

<style type="postcss">
  .rz-blocks-cell {
    min-width: var(--rz-size-24);
  }
</style>
