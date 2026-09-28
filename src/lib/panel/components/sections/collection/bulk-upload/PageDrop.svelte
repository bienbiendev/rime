<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getNavContext } from '$lib/panel/context/nav.svelte.js';
  import {
    uploadFiles,
    type UploadProgress as Progress,
    type UploadTarget
  } from '$lib/panel/util/upload-file.js';
  import { Upload, X } from '@lucide/svelte';
  import UploadProgress from './UploadProgress.svelte';

  type Props = {
    /** Where the files go: the collection's API, the folder, the types it takes. */
    target: UploadTarget;
    /** The folder's name, as the veil says it. */
    folder: string;
    /** Off while another zone takes the files: a dialog's. */
    disabled?: boolean;
  };
  const { target, folder, disabled = false }: Props = $props();

  const nav = getNavContext();
  let over = $state(false);
  let progress = $state<Progress | null>(null);
  const busy = $derived(progress !== null && progress.current !== null);

  /** A drag of files from outside the browser, not of an element of the page. */
  const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files');

  /** Files entering the window raise the veil; the veil takes it from there. */
  function onWindowDragEnter(event: DragEvent) {
    if (disabled || busy || !carriesFiles(event)) return;
    over = true;
  }

  /** Outside the veil, on the navigation, files are refused rather than opened by the browser. */
  function onWindowDragOver(event: DragEvent) {
    if (disabled || !carriesFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }

  function onWindowDrop(event: DragEvent) {
    if (disabled || !carriesFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    over = false;
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  /** Leaving the window, or onto the navigation, lowers the veil. */
  function onDragLeave(event: DragEvent) {
    const veil = event.currentTarget as HTMLElement;
    if (!veil.contains(event.relatedTarget as Node | null)) over = false;
  }

  /** Each file becomes a document in the folder on screen, then the list reloads. */
  async function onDrop(event: DragEvent) {
    event.preventDefault();
    over = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    const { failed } = await uploadFiles(files, target, (state) => (progress = state));
    await invalidateAll();
    if (!failed.length) progress = null;
  }
</script>

<svelte:window
  ondragenter={onWindowDragEnter}
  ondragover={onWindowDragOver}
  ondrop={onWindowDrop}
/>

{#if over}
  <!-- An accent veil over the page while files hover it. -->
  <div
    class="rz-page-drop"
    role="region"
    aria-label={t__('common.drop_to_upload_into', folder)}
    style:left={nav?.width ?? '0'}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
  >
    <p class="rz-page-drop__label">
      <Upload size={16} />
      {t__('common.drop_to_upload_into', folder)}
    </p>
  </div>
{/if}

{#if progress}
  <!-- The batch on its way, in a corner; it stays on a failure until closed. -->
  <div class="rz-page-drop__progress">
    <UploadProgress {progress} />
    {#if !busy}
      <Button
        variant="ghost"
        size="icon-sm"
        icon={X}
        aria-label={t__('common.close')}
        onclick={() => (progress = null)}
      />
    {/if}
  </div>
{/if}

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-page-drop {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: var(--rz-size-4);
    background-color: var(--rz-accent-tint);
    box-shadow: inset 0 0 0 2px var(--rz-accent-border);
    backdrop-filter: blur(2px);
  }

  .rz-page-drop__label {
    @mixin surface float;
    @mixin font-medium;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    padding: var(--rz-size-2-5) var(--rz-size-4);
    border-radius: var(--rz-radius-full);
    color: var(--rz-accent-text);
    pointer-events: none;
  }

  .rz-page-drop__progress {
    @mixin surface float;
    position: fixed;
    right: var(--rz-size-4);
    bottom: var(--rz-size-4);
    z-index: 200;
    display: flex;
    align-items: flex-start;
    gap: var(--rz-size-2);
    width: min(var(--rz-size-80), calc(100vw - var(--rz-size-8)));
    padding: var(--rz-size-3) var(--rz-size-2) var(--rz-size-3) var(--rz-size-4);
    border-radius: var(--rz-radius-lg);

    :global(.rz-bulk-infos) {
      flex: 1;
    }
  }
</style>
