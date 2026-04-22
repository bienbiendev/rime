<script lang="ts">
  import { getMimeTypeFromExtension } from '$lib/core/collections/upload/util/mime';
  import { mimeTypeToIcon } from '$lib/panel/util/upload.js';
  import { FileText } from '@lucide/svelte';

  type Props = {
    url?: string;
    mimeType?: string;
    class?: string;
  };
  const { url, class: className, mimeType }: Props = $props();

  const mimeTypeResolved = $derived.by(() => {
    if (mimeType) return mimeType;
    if (url) return getMimeTypeFromExtension(url.split('.').pop() || '') || '';
    return '';
  });
</script>

<div class="rz-upload-preview-cell {className}">
  <div>
    {#if url && mimeTypeResolved.includes('image')}
      <img class="rz-upload-preview-cell__image" src={url} alt="preview" />
    {:else}
      <div class="rz-upload-preview-cell__placeholder">
        {#if mimeTypeResolved}
          {@const FileIcon = mimeTypeToIcon(mimeTypeResolved)}
          <FileIcon size={14} />
        {:else}
          <FileText size={14} />
        {/if}
      </div>
    {/if}
  </div>
</div>

<style type="postcss">
  :root {
    --rz-upload-preview-cell-bg: light-dark(hsl(var(--rz-gray-15)), hsl(var(--rz-gray-0)));
    --rz-upload-preview-cell-fit: contain;
  }

  .rz-upload-preview-cell {
    --size: var(--rz-upload-preview-cell-size, var(--rz-size-9));
    display: flex;
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    pointer-events: none;
    border-radius: var(--rz-radius-sm);
    > div {
      width: 100%;
      height: 100%;
      border-radius: var(--rz-radius-sm);
      overflow: hidden;
      background: var(--rz-upload-preview-cell-bg);
      display: flex;
      place-content: center;
    }
  }

  .rz-upload-preview-cell__image {
    height: 100%;
    width: 100%;
    object-fit: var(--rz-upload-preview-cell-fit);
  }

  .rz-upload-preview-cell__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
