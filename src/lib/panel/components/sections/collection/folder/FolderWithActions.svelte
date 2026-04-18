<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { apiUrl } from '$lib/core/api/index.js';
  import type { Directory } from '$lib/core/collections/upload/upload.js';
  import type { BuiltCollectionClient } from '$lib/core/config/types.js';
  import { PARAMS } from '$lib/core/constant.js';
  import { withDirectoriesSuffix } from '$lib/core/naming.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import ContextMenu from '$lib/panel/components/ui/context-menu/ContextMenu.svelte';
  import ContextMenuItem from '$lib/panel/components/ui/context-menu/ContextMenuItem.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { API_PROXY, getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { panelUrl } from '$lib/panel/util/url.js';
  import { trycatchFetch } from '$lib/util/function.js';
  import { Pencil, Trash2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../../core/i18n/index.js';
  import Folder from './Folder.svelte';
  import FolderEdit from './FolderEdit.svelte';

  type Props = {
    folder: Directory;
    collection: BuiltCollectionClient;
    onDelete?: (path: string) => void;
    onDocumentDrop: (args: { documentId: string; path: string }) => void;
    draggable?: 'true';
    display?: 'grid' | 'list';
  };
  const {
    folder,
    collection,
    onDelete,
    onDocumentDrop,
    draggable,
    display = 'grid'
  }: Props = $props();

  let deleteConfirmOpen = $state(false);
  let editFolderDialogOpen = $state(false);
  let message = $state('');
  let rootElement = $state<HTMLButtonElement>();
  let isDragging = $state(false);
  const isFolderUpperPath = $derived(folder.name === '...');
  const APIProxy = getAPIProxyContext(API_PROXY.ROOT);
  const childFilesURL = $derived(
    `${apiUrl(collection.kebab)}?where[_path][equals]=${folder.id}&select=id`
  );
  const childFiles = $derived(APIProxy.getRessource<{ docs: GenericDoc[] }>(childFilesURL));
  const childFilesCount = $derived(childFiles.data?.docs?.length || 0);
  const baseFolderApiURL = $derived(`${apiUrl(withDirectoriesSuffix(collection.kebab))}`);
  const childFoldersURL = $derived(
    `${baseFolderApiURL}?where[parent][equals]=${folder.id}&select=id`
  );
  const childFolders = $derived(APIProxy.getRessource<{ docs: GenericDoc[] }>(childFoldersURL));
  const childFoldersCount = $derived(childFolders.data?.docs?.length || 0);

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
    goto(`${panelUrl(collection.kebab)}?${PARAMS.UPLOAD_PATH}=${folder.id}`);
  }

  function handleDragStart(e: DragEvent) {
    isDragging = true;
    e.dataTransfer?.setData('text/plain', folder.id);
  }
  function handleDragEnd() {
    isDragging = false;
  }
</script>

<button
  bind:this={rootElement}
  onclick={handleGoToFolder}
  class="rz-folder rz-folder--{display}"
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
      <!--  -->
      {#snippet trigger()}
        <Folder>{folder.name}</Folder>
      {/snippet}
      <!--  -->
      {#snippet content()}
        <ContextMenuItem onclick={handleGetDeleteInfos}>
          <Trash2 size="12" /> Delete
        </ContextMenuItem>
        <ContextMenuItem onclick={() => (editFolderDialogOpen = true)}>
          <Pencil size="12" /> Edit
        </ContextMenuItem>
      {/snippet}
      <!--  -->
    </ContextMenu>
  {:else}
    <div>
      <Folder>{folder.name}</Folder>
    </div>
  {/if}

  <span></span>
</button>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      {t__('common.delete_dialog_title', folder.name)}
    </Dialog.Header>
    <p>{message}</p>
    <Dialog.Footer --rz-justify-content="space-between">
      <Button onclick={handleDelete}>Delete</Button>
      <Button onclick={() => (deleteConfirmOpen = false)} variant="secondary">Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<FolderEdit bind:open={editFolderDialogOpen} {folder} {collection} />

<style lang="postcss">
  :root {
    --rz-folder-hover-bg: light-dark(hsl(var(--rz-gray-14)), hsl(var(--rz-gray-1)));
  }

  .rz-folder--dragging {
    pointer-events: none;
    opacity: 0.5;
  }

  .rz-folder {
    width: 100%;
    padding: var(--rz-size-5);
    border-radius: var(--rz-radius-lg);

    :global {
      &.rz-folder--dragover {
        background-color: var(--rz-folder-hover-bg);
      }
    }
  }

  .rz-folder.rz-folder--grid {
    aspect-ratio: 4 / 5;
  }
  .rz-folder.rz-folder--list {
    height: var(--rz-row-height);
    padding: var(--rz-size-1-5);

    :global {
      > div {
        padding: 0;
        display: flex;
        gap: var(--rz-size-4);
        align-items: center;
        justify-content: flex-start;
        h3 {
          font-size: var(--rz-text-md);
        }
        svg {
          display: block;
          height: auto;
          width: 2rem;
          transform: translateY(-0.12em);
        }
      }
    }
  }

  .rz-folder.rz-folder--grid:hover {
    background-color: var(--rz-folder-hover-bg);
  }
</style>
