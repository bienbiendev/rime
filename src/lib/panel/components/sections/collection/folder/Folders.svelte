<script lang="ts">
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import Folder from './FolderWithActions.svelte';

  type Props = { collection: CollectionContext };
  const { collection }: Props = $props();

  // A search lists files only.
  const show = $derived(
    collection.isUpload &&
      !collection.isFiltered &&
      !!(collection.upload.parentDirectory || collection.upload.directories.length)
  );

  function onDeleteFolder(path: string) {
    collection.upload.directories = collection.upload.directories.filter((dir) => dir.id !== path);
  }

  /** A document dropped on a folder takes the folder's path. */
  function onDocumentDrop(args: { documentId: string; path: string }) {
    const { documentId, path } = args;
    const docIndex = collection.docs.findIndex((doc) => doc.id === documentId);
    if (docIndex > -1) {
      collection.docs[docIndex]._path = path;
    } else {
      console.error("can't find " + documentId, collection.docs);
    }
  }
</script>

<!-- The folders of an upload collection, the parent one first, above its files. -->
{#if show}
  <div class="rz-folders">
    {#if collection.upload.parentDirectory}
      <Folder
        {onDocumentDrop}
        folder={{ ...collection.upload.parentDirectory, name: '...' }}
        collection={collection.config}
      />
    {/if}

    {#each collection.upload.directories as folder (folder.id)}
      <Folder
        draggable="true"
        {onDocumentDrop}
        {folder}
        collection={collection.config}
        onDelete={onDeleteFolder}
      />
    {/each}
  </div>
{/if}

<style lang="postcss">
  .rz-folders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--rz-size-40), 1fr));
    gap: var(--rz-size-2);
  }
</style>
