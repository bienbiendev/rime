<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { SquareCheck, SquareMinus, Trash } from '@lucide/svelte';

  const collection = getCollectionContext();
  const selectedCount = $derived(collection.selected.length);

  // 2 documents, 1 file
  const countLabel = $derived.by(() => {
    const key = collection.isUpload ? 'common.collection_count_files' : 'common.collection_count';
    return t__(selectedCount === 1 ? key : `${key}|m|p`, String(selectedCount));
  });
</script>

<!-- The actions on the checked documents, while one is checked. -->
{#if selectedCount > 0}
  <div class="rz-header-select">
    {#if collection.isAllSelected}
      <Button
        variant="ghost"
        size="sm"
        icon={SquareMinus}
        onclick={() => (collection.selected = [])}
      >
        {t__('common.collection_deselect_all')}
      </Button>
    {:else}
      <Button variant="ghost" size="sm" icon={SquareCheck} onclick={collection.selectAll}>
        {t__('common.select_all')}
      </Button>
    {/if}
    <Button size="sm" icon={Trash} variant="ghost" onclick={collection.deleteSelection}>
      {t__('common.delete', countLabel)}
    </Button>
  </div>
{/if}

<style type="postcss">
  .rz-header-select {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: flex;
    gap: var(--rz-size-1);
    align-items: center;
  }
</style>
