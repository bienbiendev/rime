<script lang="ts">
  import { page } from '$app/state';
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { UPLOAD_PATH } from '$lib/core/prototype/collection/upload/constant.js';
  import { isUploadConfig } from '$lib/core/prototype/collection/upload/util/config';
  import type { GenericDoc } from '$lib/core/prototype/types';
  import { panelPath } from '$lib/core/routes/util';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { mediaMeta } from '$lib/panel/util/upload-file.js';
  import type { BuiltCollection } from '$lib/types';
  import { Check } from '@lucide/svelte';
  import StatusDot from '../../StatusDot.svelte';

  type Props = {
    checked: boolean;
    doc: GenericDoc;
    draggable?: 'true';
    /** On while an item is checked: a click on the card then picks it. */
    isSelectMode?: boolean;
    config: BuiltCollection;
    /** Given, the thumbnail carries a ring to pick the item: shown on hover, and while picking. */
    toggleSelectOf?: (id: string) => void;
  };

  const { checked, doc, draggable, isSelectMode, config, toggleSelectOf }: Props = $props();

  const locale = getLocaleContext();
  const isUploadCollection = $derived(isUploadConfig(config));
  const hasDraft = $derived(!!(config.versions && config.versions.draft));

  const mimeType = $derived(typeof doc.mimeType === 'string' ? doc.mimeType : '');
  const isImage = $derived(!!doc._thumbnail && mimeType.startsWith('image/'));
  // A photo fills its frame; a png, a gif or an svg may be a logo, so it shows whole.
  const contain = $derived(/^image\/(png|gif|svg)/.test(mimeType));

  // brochure-2026.pdf -> PDF
  const extension = $derived.by(() => {
    const filename = typeof doc.filename === 'string' ? doc.filename : '';
    const fromName = filename.includes('.') ? filename.split('.').pop() : '';
    return (fromName || mimeType.split('/').pop() || '').toUpperCase();
  });

  const name = $derived(doc.title || doc.filename || '[untitled]');

  // 3.2 MB · JPG for a file, the last edit for a document.
  const meta = $derived.by(() => {
    if (isUploadCollection) return mediaMeta({ filesize: doc.filesize, mimeType });
    return doc.updatedAt ? locale.dateFormat(doc.updatedAt, { short: true }) : '';
  });

  const href = $derived.by(() => {
    const uploadPath = isUploadCollection
      ? page.url.searchParams.get(PARAMS.UPLOAD_PATH) || UPLOAD_PATH.ROOT_NAME
      : null;
    const params = uploadPath ? `?${PARAMS.UPLOAD_PATH}=${uploadPath}` : '';
    return `${panelPath(config.kebab, doc.id)}${params}` as ResolvedPathname;
  });

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', doc.id);
  }
</script>

{#snippet body()}
  <span class="rz-grid-item__thumb">
    {#if isImage}
      <img
        class="rz-grid-item__image"
        class:rz-grid-item__image--contain={contain}
        src={doc._thumbnail}
        alt=""
        loading="lazy"
      />
    {:else if isUploadCollection}
      <span class="rz-grid-item__extension">{extension}</span>
    {:else}
      {@const Icon = config.icon}
      <Icon size={18} />
    {/if}
  </span>

  <span class="rz-grid-item__text">
    <span class="rz-grid-item__name">{name}</span>
    {#if meta || (hasDraft && doc.status)}
      <span class="rz-grid-item__meta">
        {#if hasDraft && doc.status}
          <StatusDot --rz-dot-size="var(--rz-size-1-5)" status={doc.status} />
        {/if}
        {meta}
      </span>
    {/if}
  </span>
{/snippet}

<!-- A media card: the thumbnail, the name, then its size and type. While picking, a click picks it. -->
<div
  class="rz-grid-item"
  class:rz-grid-item--picked={checked}
  class:rz-grid-item--select-mode={isSelectMode}
>
  {#if isSelectMode}
    <button
      type="button"
      class="rz-grid-item__card"
      aria-pressed={checked}
      onclick={() => toggleSelectOf?.(doc.id)}
      draggable={draggable || null}
      ondragstart={draggable ? handleDragStart : null}
    >
      {@render body()}
    </button>
  {:else}
    <a
      class="rz-grid-item__card"
      {href}
      draggable={draggable || null}
      ondragstart={draggable ? handleDragStart : null}
    >
      {@render body()}
    </a>
  {/if}

  {#if toggleSelectOf}
    <!-- An empty ring on the thumbnail; filled with the accent and a check once picked. -->
    <button
      type="button"
      role="checkbox"
      class="rz-grid-item__pick"
      aria-checked={checked}
      aria-label={name}
      tabindex={isSelectMode ? -1 : 0}
      onclick={() => toggleSelectOf(doc.id)}
    >
      <Check size={11} strokeWidth={2.5} />
    </button>
  {/if}
</div>

<style lang="postcss">
  @import '../../../../../style/mixins/index.css';

  .rz-grid-item {
    position: relative;
    min-width: 0;
  }

  .rz-grid-item__card {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-2);
    width: 100%;
    min-width: 0;
    text-align: left;
    color: var(--rz-fg);

    &:focus-visible {
      outline: none;
    }
  }

  .rz-grid-item__thumb {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-subtle);
    overflow: hidden;

    /* A faint ring inside the edge, so a pale image keeps its shape. */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px var(--rz-border);
      pointer-events: none;
      transition: box-shadow 0.15s;
    }
  }

  .rz-grid-item:hover .rz-grid-item__thumb::after {
    box-shadow: inset 0 0 0 1px var(--rz-border-strong);
  }

  .rz-grid-item__card:focus-visible .rz-grid-item__thumb {
    @mixin focus-ring;
  }

  .rz-grid-item--picked .rz-grid-item__thumb {
    outline: 2px solid var(--rz-accent);
    outline-offset: 2px;
  }

  .rz-grid-item__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .rz-grid-item__image--contain {
    object-fit: contain;
  }

  .rz-grid-item__extension {
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-sm);
    @mixin font-semibold;
    letter-spacing: 0.04em;
  }

  /* Hidden until the card is hovered or focused, or an item is picked. */
  .rz-grid-item__pick {
    position: absolute;
    z-index: 1;
    top: var(--rz-size-1-5);
    left: var(--rz-size-1-5);
    display: grid;
    place-items: center;
    width: var(--rz-size-5);
    height: var(--rz-size-5);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-bg-overlay);
    box-shadow: inset 0 0 0 1.5px var(--rz-accent-fg);
    color: var(--rz-accent-fg);
    opacity: 0;
    transition: opacity 0.15s;

    :global(svg) {
      opacity: 0;
    }

    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-grid-item:is(:hover, :focus-within, .rz-grid-item--select-mode) .rz-grid-item__pick {
    opacity: 1;
  }

  .rz-grid-item--picked .rz-grid-item__pick {
    background-color: var(--rz-accent);
    box-shadow: none;

    :global(svg) {
      opacity: 1;
    }
  }

  .rz-grid-item__text {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-0-5);
    min-width: 0;
  }

  .rz-grid-item__name {
    @mixin font-medium;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rz-grid-item__meta {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1-5);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
