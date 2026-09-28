<script lang="ts">
  import { panelPath } from '$lib/core/routes/util.js';
  import { mimeTypeToIcon } from '$lib/panel/util/upload.js';
  import { mediaMeta } from '$lib/panel/util/upload-file.js';
  import { Edit, FileIcon, X } from '@lucide/svelte';

  type Resource = {
    id: string;
    title: string;
    _type: string;
    mimeType?: string;
    filename?: string;
    filesize?: string;
    url?: string;
    _thumbnail?: string;
  };

  type Props = { resource: Resource; onCloseClick: () => void };
  const { resource, onCloseClick }: Props = $props();

  const isUpload = $derived('mimeType' in resource);
  const isImage = $derived(
    resource._thumbnail || (isUpload && resource.mimeType?.includes('image'))
  );
  const Icon = $derived(
    isUpload && resource.mimeType ? mimeTypeToIcon(resource.mimeType) : FileIcon
  );
</script>

<div class="rz-card-resource">
  <div class="rz-card-resource__thumbnail">
    {#if isImage}
      <img
        class="rz-card-resource__image"
        src={resource._thumbnail || resource.url}
        alt={resource.title}
      />
    {:else}
      <Icon class="rz-card-resource__icon" size={18} />
    {/if}
  </div>

  <div class="rz-card-resource__info">
    <p class="rz-card-resource__title">
      <span>{resource.title}</span>
      <a href={panelPath(resource._type, resource.id)}><Edit size="12" /></a>
    </p>
    {#if isUpload}
      <p class="rz-card-resource__info-text">{mediaMeta(resource)}</p>
    {/if}
  </div>

  <button type="button" class="rz-card-resource__remove" onclick={() => onCloseClick()}>
    <X size={11} />
  </button>
</div>

<style lang="postcss">
  @import '../../../style/mixins/index.css';

  :root {
    --rz-ressource-card-bg: var(--rz-bg-raised);
    --rz-ressource-card-thumbnail-bg: var(--rz-bg-well);
    --rz-border-radius: var(--rz-radius-md);
  }

  .rz-card-resource {
    --padding: var(--rz-card-padding, var(--rz-size-2));
    --rz-size: var(--rz-thumbnail-size, var(--rz-size-20));
    @mixin surface raised;
    background-color: var(--rz-ressource-card-bg);
    position: relative;
    display: flex;
    gap: var(--rz-size-6);
    border-radius: var(--rz-border-radius);
    padding: var(--padding);
    max-width: 400px;
  }

  .rz-card-resource__thumbnail {
    width: var(--rz-size);
    height: var(--rz-size);
    flex-shrink: 0;
    overflow: hidden;
    background-color: var(--rz-ressource-card-thumbnail-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--rz-radius-md);
  }

  .rz-card-resource__image {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }

  .rz-card-resource__info {
    margin-top: var(--rz-size-3);
    padding-right: 2rem;
  }

  .rz-card-resource__title {
    @mixin font-semibold;
    display: flex;
    align-items: center;
    margin-bottom: var(--rz-size-2);

    span {
      @mixin line-clamp 2;
      word-break: break-all;
    }

    a {
      display: inline-block;
      padding: 0.3rem;
      :global(svg) {
        translate: 0 0.05rem;
      }
    }
  }

  .rz-card-resource__info-text {
    font-size: var(--rz-text-sm);
  }

  .rz-card-resource__remove {
    position: absolute;
    color: var(--rz-fg);
    right: var(--rz-size-2);
    top: var(--rz-size-2);
    background-color: var(--rz-bg-well);
    border-radius: var(--rz-size-0-5);
    height: var(--rz-size-4);
    width: var(--rz-size-4);
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
