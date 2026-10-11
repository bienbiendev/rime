<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';

  type Item = { _children?: Item[] };
  const { value }: { value: Item[] | null } = $props();

  /** Every item, children included. */
  const countItems = (items: Item[]): number =>
    items.reduce((sum, item) => sum + 1 + countItems(item._children ?? []), 0);
  const count = $derived(countItems(value ?? []));
</script>

<div class="rz-tree-cell">
  {count === 1 ? t__('fields.items_count', '1') : t__('fields.items_count|m|p', String(count))}
</div>

<style type="postcss">
  .rz-tree-cell {
    min-width: var(--rz-size-24);
  }
</style>
