<script lang="ts">
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import Empty from '../Empty.svelte';
  import Folders from '../folder/Folders.svelte';
  import { listColumns } from './columns.js';
  import ListHeader from './header/Header.svelte';
  import Row from './row/Row.svelte';

  type Props = { collection: CollectionContext };

  const { collection }: Props = $props();

  const hasFolders = $derived(
    collection.isUpload &&
      !collection.isFiltered &&
      !!(collection.upload.directories.length || collection.upload.parentDirectory)
  );

  // A row is dragged onto a folder only when there is one to drop it on.
  const dragEnabled = $derived(
    collection.isUpload &&
      !!(collection.upload.directories.length || collection.upload.parentDirectory)
  );

  // The tracks, wide; then without the author; then the title and the date alone.
  const columns = $derived(collection.columns.length);
  const status = $derived(!!collection.hasDraft);
  const wide = $derived(listColumns({ columns, status, author: true }));
  const medium = $derived(listColumns({ columns, status }));
  const narrow = listColumns({});
</script>

<div class="rz-page-collection__list-view">
  <Folders {collection} />

  {#if collection.shown.length}
    <div
      class="rz-page-collection__list"
      style:--rz-list-tracks={wide}
      style:--rz-list-tracks-md={medium}
      style:--rz-list-tracks-sm={narrow}
    >
      <ListHeader />
      {#each collection.shown as doc (doc.id)}
        <Row
          config={collection.config}
          columns={collection.columns}
          {doc}
          path={collection.pathOf(doc)}
          checked={collection.selected.includes(doc.id)}
          draggable={dragEnabled ? 'true' : undefined}
          isSelectMode={collection.selectMode}
          toggleSelectOf={collection.toggleSelectOf}
        />
      {/each}
    </div>
  {:else if !hasFolders}
    <Empty config={collection.config} />
  {/if}
</div>

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-page-collection__list-view {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-5);
  }

  /* One raised card: the column labels, then the rows, a hairline between each. */
  .rz-page-collection__list {
    @mixin surface raised;
    border-radius: var(--rz-radius-lg);
    overflow: hidden;

    :global(:is(.rz-list-row, .rz-list-header)) {
      grid-template-columns: var(--rz-list-tracks);
    }
  }

  /* A narrower list drops the author, then the status and the config's columns. */
  @container collection-area (max-width: 44rem) {
    .rz-page-collection__list {
      :global(:is(.rz-list-row, .rz-list-header)) {
        grid-template-columns: var(--rz-list-tracks-md);
      }
      :global([data-column='author']) {
        display: none;
      }
    }
  }

  @container collection-area (max-width: 32rem) {
    .rz-page-collection__list {
      :global(:is(.rz-list-row, .rz-list-header)) {
        grid-template-columns: var(--rz-list-tracks-sm);
      }
      :global(:is([data-column='status'], [data-column='field'])) {
        display: none;
      }
    }
  }
</style>
