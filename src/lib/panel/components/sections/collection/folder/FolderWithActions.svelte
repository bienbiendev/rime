<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { BuiltCollectionClient } from '$lib/core/config/types.js';
  import { PARAMS } from '$lib/core/constants.js';
  import { directoriesKebab } from '$lib/core/prototype/collection/upload/naming.js';
  import type { Directory } from '$lib/core/prototype/collection/upload/types.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import ContextMenu from '$lib/panel/components/ui/context-menu/ContextMenu.svelte';
  import ContextMenuItem from '$lib/panel/components/ui/context-menu/ContextMenuItem.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { trycatchFetch } from '$lib/util/function.js';
  import { Folder, FolderUp, Pencil, Trash2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../../core/i18n/index.js';
  import FolderEdit from './FolderEdit.svelte';

  type Props = {
    folder: Directory;
    collection: BuiltCollectionClient;
    onDelete?: (path: string) => void;
    onDocumentDrop: (args: { documentId: string; path: string }) => void;
    draggable?: 'true';
  };
  const { folder, collection, onDelete, onDocumentDrop, draggable }: Props = $props();

  let deleteConfirmOpen = $state(false);
  let editFolderDialogOpen = $state(false);
  let message = $state('');
  let rootElement = $state<HTMLButtonElement>();
  let isDragging = $state(false);
  const isFolderUpperPath = $derived(folder.name === '...');
  const APIProxy = getAPIProxyContext();
  const childFilesURL = $derived(
    `${apiUrl(collection.kebab)}?where[_path][equals]=${folder.id}&select=id`
  );
  const childFiles = $derived(APIProxy.getRessource<{ docs: GenericDoc[] }>(childFilesURL));
  const childFilesCount = $derived(childFiles.data?.docs?.length || 0);
  const baseFolderApiURL = $derived(`${apiUrl(directoriesKebab(collection.slug))}`);
  const childFoldersURL = $derived(
    `${baseFolderApiURL}?where[parent][equals]=${folder.id}&select=id`
  );
  const childFolders = $derived(APIProxy.getRessource<{ docs: GenericDoc[] }>(childFoldersURL));
  const childFoldersCount = $derived(childFolders.data?.docs?.length || 0);
  // What the folder holds, files and folders, once both counts are in.
  const itemsCount = $derived(
    !isFolderUpperPath && childFiles.data && childFolders.data
      ? childFilesCount + childFoldersCount
      : null
  );

  async function handleGetDeleteInfos() {
    message = t__(
      'common.delete_dialog_text',
      `wich contains ${childFilesCount} file(s) and ${childFoldersCount} folder(s)`
    );
    deleteConfirmOpen = true;
  }

  async function handleDelete() {
    const url = `${baseFolderApiURL}/${folder.id}`;
    const [error] = await trycatchFetch(url, { method: 'DELETE' });
    if (error) {
      return toast.error('Error deleting folder');
    }
    toast.success(t__('delete_success'));
    deleteConfirmOpen = false;
    if (onDelete) {
      onDelete(folder.id);
    }
  }

  async function handleDropFolder(folderId: string) {
    const movedFolderPath = folderId;
    const newFolderPath = `${folder.id}:${movedFolderPath.split(':').at(-1)}`;
    const moveAPICallURL = `${baseFolderApiURL}/${folderId}`;
    const [error] = await trycatchFetch(moveAPICallURL, {
      method: 'PATCH',
      body: JSON.stringify({ id: newFolderPath })
    });

    if (error) {
      console.error(error);
      return toast.error('Error moving folder');
    }

    toast.success('Folder moved successfully');
    childFolders.refresh();
    return invalidateAll();
  }

  async function handleDropDocument(docId: string) {
    const moveDocumentAPICallURL = apiUrl(collection.kebab, docId);
    const [error] = await trycatchFetch(moveDocumentAPICallURL, {
      method: 'PATCH',
      body: JSON.stringify({ _path: folder.id })
    });
    if (error) {
      console.error(error);
      return toast.error('Error moving document');
    }
    toast.success('Document moved successfully');
    if (onDocumentDrop) {
      onDocumentDrop({ documentId: docId, path: folder.id });
    }
    childFiles.refresh();
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault(); // prevent default browser behavior
    rootElement?.classList.remove('rz-folder--dragover');
    // Get the document ID from dataTransfer
    const docId = e.dataTransfer?.getData('text/plain');

    if (!docId) return;
    // Handle drop folder
    if (docId.includes(':')) {
      if (docId === folder.id) return;
      return handleDropFolder(docId);
    }
    // Handle a drop document
    return handleDropDocument(docId);
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    rootElement?.classList.add('rz-folder--dragover');
  }

  function handleDragLeave() {
    rootElement?.classList.remove('rz-folder--dragover');
  }

  function handleGoToFolder() {
    goto(resolve(`${panelPath(collection.kebab)}?${PARAMS.UPLOAD_PATH}=${folder.id}`));
  }

  function handleDragStart(e: DragEvent) {
    isDragging = true;
    e.dataTransfer?.setData('text/plain', folder.id);
  }
  function handleDragEnd() {
    isDragging = false;
  }
</script>

{#snippet tile()}
  <span class="rz-folder__tile">
    {#if isFolderUpperPath}
      <FolderUp size={15} />
    {:else}
      <Folder size={15} />
    {/if}
    <span class="rz-folder__name">{folder.name}</span>
    {#if itemsCount !== null}
      <span class="rz-folder__count">{itemsCount}</span>
    {/if}
  </span>
{/snippet}

<button
  bind:this={rootElement}
  type="button"
  onclick={handleGoToFolder}
  class="rz-folder"
  class:rz-folder--dragging={isDragging}
  ondragleave={handleDragLeave}
  ondragover={!isDragging ? handleDragEnter : null}
  ondragend={handleDragEnd}
  ondrop={!isDragging ? handleDrop : null}
  draggable={draggable === 'true' ? 'true' : null}
  ondragstart={draggable === 'true' ? handleDragStart : null}
>
  {#if !isFolderUpperPath}
    <ContextMenu>
      {#snippet trigger()}
        {@render tile()}
      {/snippet}
      {#snippet content()}
        <ContextMenuItem onclick={handleGetDeleteInfos}>
          <Trash2 size="12" /> Delete
        </ContextMenuItem>
        <ContextMenuItem onclick={() => (editFolderDialogOpen = true)}>
          <Pencil size="12" /> Edit
        </ContextMenuItem>
      {/snippet}
    </ContextMenu>
  {:else}
    {@render tile()}
  {/if}
</button>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      {t__('common.delete_dialog_title', folder.name)}
    </Dialog.Header>
    <p>{message}</p>
    <Dialog.Footer>
      <Button onclick={handleDelete} kbd="enter">Delete</Button>
      <Button onclick={() => (deleteConfirmOpen = false)} variant="secondary" kbd="escape">
        {t__('common.cancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<FolderEdit bind:open={editFolderDialogOpen} {folder} {collection} />

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  /* A small raised tile: the icon, the name, what it holds. */
  .rz-folder {
    @mixin surface raised;
    display: flex;
    width: 100%;
    height: --size(10.5);
    border-radius: var(--rz-radius-lg);
    text-align: left;

    &:hover {
      @mixin hover;
    }

    &:focus-visible {
      @mixin focus-ring;
    }

    /* The context menu's trigger fills the tile. */
    > :global(div) {
      display: flex;
      flex: 1;
      min-width: 0;
    }

    :global {
      &.rz-folder--dragover {
        background-color: var(--rz-accent-tint);
        box-shadow: 0 0 0 1px var(--rz-accent-border);
      }
    }
  }

  .rz-folder--dragging {
    pointer-events: none;
    opacity: 0.5;
  }

  .rz-folder__tile {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--rz-size-2-5);
    min-width: 0;
    padding-inline: var(--rz-size-3);

    :global(svg) {
      flex-shrink: 0;
      color: var(--rz-fg-subtle);
    }
  }

  .rz-folder__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    @mixin font-medium;
  }

  .rz-folder__count {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    font-variant-numeric: tabular-nums;
  }
</style>
