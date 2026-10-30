<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import { getCollectionContext } from '#lib/panel/context/collection.svelte.js';
  import { documentsCounted } from '#lib/panel/util/count.js';
  import SquareCheck from '@lucide/svelte/icons/square-check';
  import SquareMinus from '@lucide/svelte/icons/square-minus';
  import Trash from '@lucide/svelte/icons/trash';

  const collection = getCollectionContext();
  const selectedCount = $derived(collection.selected.length);

  // 2 documents, 1 file
  const countLabel = $derived(documentsCounted(selectedCount, collection.isUpload));

  let confirmOpen = $state(false);

  async function confirmDelete() {
    confirmOpen = false;
    await collection.deleteSelection();
  }
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
    <Button size="sm" icon={Trash} variant="ghost" onclick={() => (confirmOpen = true)}>
      {t__('common.delete', countLabel)}
    </Button>
  </div>
{/if}

<!-- Deleting checked documents cannot be undone: the dialog names how many go. -->
<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content>
    <Dialog.Header>{t__('common.delete_dialog_title', countLabel)}</Dialog.Header>
    <p>{t__('common.delete_dialog_text', countLabel)}</p>
    <Dialog.Footer>
      <Button onclick={confirmDelete} kbd="enter">{t__('common.delete', countLabel)}</Button>
      <Button onclick={() => (confirmOpen = false)} variant="secondary" kbd="escape">
        {t__('common.cancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style type="postcss">
  .rz-header-select {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: flex;
    gap: var(--rz-size-1);
    align-items: center;
  }
</style>
