<script lang="ts">
  import { mediaMeta } from '$lib/panel/util/upload-file.js';
  import type { GenericDoc } from '$lib/types';
  import StatusDot from '../../sections/collection/StatusDot.svelte';
  import UploadThumbCell from '../../sections/collection/upload-thumb-cell/UploadThumbCell.svelte';

  type Props = { doc: GenericDoc };
  const { doc }: Props = $props();

  const thumbnailUrl = $derived.by(() => {
    if (doc.mimeType && doc.mimeType.includes('image')) {
      return doc._thumbnail;
    }
    return null;
  });
</script>

<div class="rz-document-card">
  <div class="rz-document-card__preview">
    <UploadThumbCell mimeType={doc.mimeType} url={thumbnailUrl || doc._thumbnail} />
  </div>

  <div class="rz-document-card__body">
    <p class="rz-document-card__title">
      {doc.title}
    </p>

    {#if doc.filesize || doc.mimeType}
      <div class="rz-document-card__metadata">
        <p>{mediaMeta(doc as { filesize?: string; mimeType?: string })}</p>
      </div>
    {/if}

    {#if doc.status}
      <StatusDot status={doc.status} />
    {/if}
  </div>
</div>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  .rz-document-card {
    --rz-dot-size: var(--rz-size-2);
    --rz-upload-preview-cell-bg: var(--rz-bg-well);
    @mixin surface raised;
    border-radius: var(--rz-radius-lg);
    aspect-ratio: 4 / 5;
    width: 100%;
  }

  .rz-document-card:hover {
    @mixin hover;
  }

  .rz-document-card :global(.rz-upload-preview-cell) {
    width: 100%;
    height: 100%;
    aspect-ratio: 5/4;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    padding: var(--rz-size-1);

    > div {
      border-radius: var(--rz-radius-sm);
      overflow: hidden;
    }
  }

  .rz-document-card__title {
    margin-top: var(--rz-size-2);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
    text-align: left;

    @mixin font-semibold;
  }

  .rz-document-card__body {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-2);
    text-align: left;
    padding: 0 0.6rem 0.6rem 0.6rem;
  }

  .rz-document-card__metadata {
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
  }
</style>
