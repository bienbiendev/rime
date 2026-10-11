<script lang="ts">
  import { prototypeKebab } from '#lib/core/prototype/naming.js';
  import { panelPath } from '#lib/core/routes/util.js';
  import { mimeTypeToIcon } from '#lib/panel/util/upload.js';
  import { mediaMeta } from '#lib/panel/util/upload-file.js';
  import Edit from '@lucide/svelte/icons/edit';
  import FileIcon from '@lucide/svelte/icons/file';
  import X from '@lucide/svelte/icons/x';

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
      <!-- A document that is missing, or the reader may not read, has no _type and no link -->
      {#if resource._type}
        <a href={panelPath(prototypeKebab(resource._type), resource.id)}><Edit size="12" /></a>
      {/if}
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
    @mixin surface raised;
    background-color: var(--rz-ressource-card-bg);
    position: relative;
    display: flex;
    gap: var(--rz-size-6);
    border-radius: var(--rz-border-radius);
    padding: var(--rz-size-2);
    max-width: 400px;
  }

  .rz-card-resource__thumbnail {
    width: var(--rz-size-20);
    height: var(--rz-size-20);
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
