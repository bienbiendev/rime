<script lang="ts">
  import { UPLOAD_PATH } from '#lib/core/prototype/collection/upload/constant.js';
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { BuiltCollectionClient } from '#lib/core/config/types.js';
  import { PARAMS } from '#lib/core/constants.js';
  import { directoriesKebab } from '#lib/core/prototype/collection/upload/naming.js';
  import type { Directory } from '#lib/core/prototype/collection/upload/types.js';
  import { apiUrl, panelPath } from '#lib/core/routes/util.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import ContextMenu from '#lib/panel/components/ui/context-menu/ContextMenu.svelte';
  import ContextMenuItem from '#lib/panel/components/ui/context-menu/ContextMenuItem.svelte';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import { trycatchFetch } from '#lib/util/function.js';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderUp from '@lucide/svelte/icons/folder-up';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
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
  let rootElement = $state<HTMLButtonElement>();
  let isDragging = $state(false);
  const isFolderUpperPath = $derived(folder.name === '...');
  const APIProxy = getAPIProxyContext();
  // Counts, through the API proxy: a save's `invalidate('/api/<slug>')` fetches them again
  const childFilesURL = $derived(
    `${apiUrl(collection.kebab, 'count')}?where[_path][equals]=${folder.id}`
  );
  const childFiles = $derived(
    isFolderUpperPath ? null : APIProxy.getRessource<{ count: number }>(childFilesURL)
  );
  const childFilesCount = $derived(childFiles?.data?.count ?? 0);
  const baseFolderApiURL = $derived(`${apiUrl(directoriesKebab(collection.slug))}`);
  const childFoldersURL = $derived(`${baseFolderApiURL}/count?where[parent][equals]=${folder.id}`);
  const childFolders = $derived(
    isFolderUpperPath ? null : APIProxy.getRessource<{ count: number }>(childFoldersURL)
  );
  const childFoldersCount = $derived(childFolders?.data?.count ?? 0);
  // What the folder holds, files and folders, once both counts are in.
  // The parent tile asks for nothing and shows no count.
  const itemsCount = $derived(
    childFiles?.data && childFolders?.data ? childFilesCount + childFoldersCount : null
  );

  /** The delete dialog's text: the folder's name, then what it holds once both counts are in. */
  const message = $derived.by(() => {
    const named = t__('common.delete_dialog_text', folder.name);
    if (itemsCount === null) return named;
    return `${named} ${t__('common.folder_holds', String(childFilesCount), String(childFoldersCount))}`;
  });

  /** Deletes the folder, then lets the list drop its tile. */
  async function handleDelete() {
    const url = `${baseFolderApiURL}/${folder.id}`;
    const [error] = await trycatchFetch(url, { method: 'DELETE' });
    if (error) {
      return toast.error(t__('common.folder_delete_error'));
    }
    toast.success(t__('common.folder_deleted'));
    deleteConfirmOpen = false;
    if (onDelete) {
      onDelete(folder.id);
    }
  }

  /**
   * Moves the dropped folder under this one: its id, which is its path, takes this folder's path.
   */
  async function handleDropFolder(folderId: string) {
    const name = folderId.split(UPLOAD_PATH.SEPARATOR).at(-1);
    const newFolderPath = `${folder.id}${UPLOAD_PATH.SEPARATOR}${name}`;
    const moveAPICallURL = `${baseFolderApiURL}/${folderId}`;
    const [error] = await trycatchFetch(moveAPICallURL, {
      method: 'PATCH',
      body: JSON.stringify({ id: newFolderPath })
    });

    if (error) {
      console.error(error);
      return toast.error(t__('common.folder_move_error'));
    }

    toast.success(t__('common.folder_moved'));
    childFolders?.refresh();
    return invalidateAll();
  }

  /** Moves the dropped document into this folder by setting its `_path`. */
  async function handleDropDocument(docId: string) {
    const moveDocumentAPICallURL = apiUrl(collection.kebab, docId);
    const [error] = await trycatchFetch(moveDocumentAPICallURL, {
      method: 'PATCH',
      body: JSON.stringify({ _path: folder.id })
    });
    if (error) {
      console.error(error);
      return toast.error(t__('common.document_move_error'));
    }
    toast.success(t__('common.document_moved'));
    onDocumentDrop({ documentId: docId, path: folder.id });
    childFiles?.refresh();
  }

  /**
   * A tile dropped on this one: the dragged id is a folder's path when it holds `:`
   * (`root:press`), else a document's id (GridItem.svelte and Row.svelte set it).
   */
  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    rootElement?.classList.remove('rz-folder--dragover');
    const docId = e.dataTransfer?.getData('text/plain');

    if (!docId) return;
    // Handle drop folder
    if (docId.includes(UPLOAD_PATH.SEPARATOR)) {
      if (docId === folder.id) return;
      return handleDropFolder(docId);
    }
    // Handle a drop document
    return handleDropDocument(docId);
  }

  /** Marks the tile while something is dragged over it; bound to `dragover`, so it repeats. */
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    rootElement?.classList.add('rz-folder--dragover');
  }

  function handleDragLeave() {
    rootElement?.classList.remove('rz-folder--dragover');
  }

  /** Opens the folder: the collection page at `?uploadPath=<path>`. */
  function handleGoToFolder() {
    const href: string = `${panelPath(collection.kebab)}?${PARAMS.UPLOAD_PATH}=${folder.id}`;
    goto(resolve(href));
  }

  /** Puts the folder's path on the drag, for the tile it is dropped on. */
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
        <ContextMenuItem onclick={() => (deleteConfirmOpen = true)}>
          <Trash2 size="12" />
          {t__('common.delete_confirm')}
        </ContextMenuItem>
        <ContextMenuItem onclick={() => (editFolderDialogOpen = true)}>
          <Pencil size="12" />
          {t__('common.edit')}
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
      <Button onclick={handleDelete} kbd="enter">{t__('common.delete_confirm')}</Button>
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
