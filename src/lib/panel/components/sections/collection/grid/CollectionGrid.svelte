<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import ContextMenu from '$lib/panel/components/ui/context-menu/ContextMenu.svelte';
  import ContextMenuItem from '$lib/panel/components/ui/context-menu/ContextMenuItem.svelte';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { FolderPlus } from '@lucide/svelte';
  import Empty from '../Empty.svelte';
  import Folders from '../folder/Folders.svelte';
  import GridItem from './grid-item/GridItem.svelte';

  type Props = { collection: CollectionContext; oncreatefolder: () => void };
  const { collection, oncreatefolder }: Props = $props();

  const hasContentUnfiltered = $derived(
    !collection.isFiltered &&
      (collection.docs.length ||
        (collection.isUpload && collection.upload.directories.length) ||
        (collection.isUpload && collection.upload.parentDirectory))
  );

  const hasDocsFiltered = $derived(collection.isFiltered && collection.docs.length);

  // An item is dragged onto a folder only when there is one to drop it on.
  const dragEnabled = $derived(
    collection.isUpload &&
      !!(collection.upload.directories.length || collection.upload.parentDirectory)
  );
</script>

{#if hasContentUnfiltered || hasDocsFiltered}
  <div class="rz-page-collection__grid">
    <Folders {collection} />

    {#if collection.shown.length}
      <div class="rz-page-collection__grid-inner">
        {#each collection.shown as doc (doc.id)}
          <GridItem
            config={collection.config}
            toggleSelectOf={collection.toggleSelectOf}
            isSelectMode={collection.selectMode}
            draggable={dragEnabled ? 'true' : undefined}
            {doc}
            checked={collection.selected.includes(doc.id)}
          />
        {/each}
      </div>
    {:else if collection.statusFilter !== 'all' || collection.kindFilter !== 'all'}
      <Empty config={collection.config} />
    {/if}

    <!-- A right click on the empty space around the items offers a new folder. -->
    {#if collection.isUpload}
      <ContextMenu>
        {#snippet trigger()}
          <div class="rz-collection-grid__context-menu-trigger"></div>
        {/snippet}
        {#snippet content()}
          <ContextMenuItem onclick={oncreatefolder}>
            <FolderPlus size="14" />
            {t__('common.create_folder')}
          </ContextMenuItem>
        {/snippet}
      </ContextMenu>
    {/if}
  </div>
{:else}
  <Empty config={collection.config} />
{/if}

<style lang="postcss">
  .rz-page-collection__grid {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-5);
    min-height: calc(100vh - 20rem);
  }

  .rz-page-collection__grid-inner {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(--size(34), 1fr));
    gap: --size(4.5) var(--rz-size-3-5);
  }

  .rz-collection-grid__context-menu-trigger {
    position: absolute;
    inset: 0;
    z-index: -1;
  }
</style>
