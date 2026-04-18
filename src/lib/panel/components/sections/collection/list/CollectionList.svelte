<script lang="ts">
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import Empty from '../Empty.svelte';
  import Folder from '../folder/FolderWithActions.svelte';
  import Row from './row/Row.svelte';
  type Props = { collection: CollectionContext };
  const { collection }: Props = $props();

  const documents = $derived.by(() => {
    return collection.isUpload
      ? collection.docs.filter((doc) => doc._path === collection.upload.currentPath)
      : collection.docs;
  });

  function onDeleteFolder(path: string) {
    collection.upload.directories = collection.upload.directories.filter((dir) => dir.id !== path);
  }
</script>

{#if collection.docs.length}
  <div class="rz-page-collection__list">
    <!-- Parent directory -->
    {#if collection.isUpload && collection.upload.parentDirectory && !collection.isFiltered}
      <Folder
        onDocumentDrop={() => {}}
        folder={{ ...collection.upload.parentDirectory, name: '...' }}
        display="list"
        collection={collection.config}
      />
    {/if}

    {#if !collection.isFiltered && collection.isUpload}
      {#each collection.upload.directories as folder (folder.id)}
        <Folder
          draggable="true"
          onDocumentDrop={() => {}}
          {folder}
          collection={collection.config}
          display="list"
          onDelete={onDeleteFolder}
        />
      {/each}
    {/if}

    {#each documents as doc, index (index)}
      {@const checked = collection.selected.includes(doc.id)}
      <Row {doc} {checked} />
    {/each}
  </div>
{:else}
  <Empty config={collection.config} />
{/if}

<style lang="postcss">
  .rz-page-collection__list {
    gap: var(--rz-size-2);
    display: grid;
  }
</style>
