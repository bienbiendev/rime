<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import FileDrop from '$lib/panel/components/sections/collection/bulk-upload/FileDrop.svelte';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import {
    acceptLabel,
    mediaMeta,
    typeLabel,
    uploadFiles,
    type UploadProgress
  } from '$lib/panel/util/upload-file.js';
  import { Upload, X } from '@lucide/svelte';
  import Sortable from 'sortablejs';
  import type { RelationComponentProps } from '../types.js';
  import Browse from './Browse.svelte';
  import './upload.css';

  type Props = RelationComponentProps & {
    /** The library picker is open. */
    browsing?: boolean;
  };

  let {
    hasError,
    readOnly,
    setValue,
    addUploaded,
    many,
    selectedItems,
    removeValue,
    relationConfig,
    onOrderChange,
    formNestedLevel,
    onRelationCreation,
    onRelationCreationCanceled,
    stamp,
    browsing = $bindable(false)
  }: Props = $props();

  const APIProxy = getAPIProxyContext();
  /** What the picker marks, in order. */
  const selected = $derived(selectedItems.map((item) => item.documentId));
  /** A field of one: its pick, drawn as a card in the zone's place. */
  const picked = $derived(many ? undefined : selectedItems[0]);
  const accept = $derived(relationConfig.upload?.accept);

  /* ------------------------------------------------------------ uploading */

  let progress = $state<UploadProgress | null>(null);
  let failed = $state<string[]>([]);

  /** Each file becomes a media of the library, then a pick of the field. */
  async function upload(files: File[]) {
    failed = [];
    const target = { url: apiUrl(relationConfig.kebab), accept };
    const result = await uploadFiles(files, target, (state) => (progress = state));
    progress = null;
    failed = result.failed;
    if (!result.docs.length) return;
    addUploaded(result.docs);
    APIProxy.invalidate(apiUrl(relationConfig.kebab));
  }

  /* ------------------------------------------------------------ ordering */

  let list = $state<HTMLElement>();

  $effect(() => {
    if (!many || !list || readOnly) return;
    const sortable = Sortable.create(list, {
      animation: 150,
      draggable: '.rz-relation-upload__thumb',
      onEnd: ({ oldDraggableIndex, newDraggableIndex }) => {
        if (oldDraggableIndex !== undefined && newDraggableIndex !== undefined) {
          onOrderChange(oldDraggableIndex, newDraggableIndex);
        }
      }
    });
    return () => sortable.destroy();
  });

  /* ------------------------------------------------------------ slots */

  /**
   * Empty squares after the picks, to the end of their row, five to a row.
   *
   * ```
   * 3 picks  ■ ■ ■ □ □
   * 5 picks  ■ ■ ■ ■ ■
   * 6 picks  ■ ■ ■ ■ ■ / ■ □ □ □ □
   * ```
   */
  const SLOTS = 5;
  const slots = $derived(many ? (SLOTS - (selectedItems.length % SLOTS)) % SLOTS : 0);
</script>

{#snippet uploading(current: UploadProgress)}
  {t__(
    'fields.uploading',
    String(Math.min(current.uploaded + current.failed.length + 1, current.total)),
    String(current.total)
  )}
{/snippet}

{#if picked}
  <!--
    One pick: its image, name and size, then upload another file or remove it. A file dropped on
    the card replaces the pick.
  -->
  <FileDrop
    class="rz-relation-upload__card"
    {accept}
    disabled={readOnly || !!progress}
    data-error={hasError ? '' : undefined}
    onfiles={upload}
  >
    {#snippet children({ browse })}
      <a
        class="rz-relation-upload__card-thumb"
        href={panelPath(relationConfig.kebab, picked.documentId)}
        aria-label={picked.title}
      >
        {#if progress}
          <SpinLoader />
        {:else if picked.isImage && picked.url}
          <img src={picked.url} alt="" />
        {:else}
          <span class="rz-relation-upload__type">{typeLabel(picked.mimeType)}</span>
        {/if}
      </a>
      <div class="rz-relation-upload__card-info">
        <a
          class="rz-relation-upload__card-name"
          href={panelPath(relationConfig.kebab, picked.documentId)}
        >
          {picked.title}
        </a>
        <span class="rz-relation-upload__card-meta" aria-live="polite">
          {#if progress}{@render uploading(progress)}{:else}{mediaMeta(picked)}{/if}
        </span>
      </div>
      {#if !readOnly && !progress}
        <div class="rz-relation-upload__card-actions">
          <button
            type="button"
            title={t__('fields.upload_another')}
            aria-label={t__('fields.upload_another')}
            onclick={browse}
          >
            <Upload size={15} />
          </button>
          <button
            type="button"
            title={t__('fields.remove_item', picked.title)}
            aria-label={t__('fields.remove_item', picked.title)}
            onclick={() => removeValue(picked.documentId)}
          >
            <X size={15} />
          </button>
        </div>
      {/if}
      <span class="rz-relation-upload__card-drop" aria-hidden="true">
        <Upload size={15} />
        {t__('fields.drop_to_replace')}
      </span>
    {/snippet}
  </FileDrop>
  {#if failed.length}
    <p class="rz-relation-upload__failed">{t__('fields.upload_failed', failed.join(', '))}</p>
  {/if}
{:else if !readOnly}
  <FileDrop
    class="rz-relation-upload__drop"
    multiple={many}
    {accept}
    disabled={!!progress}
    data-error={hasError ? '' : undefined}
    onfiles={upload}
  >
    {#snippet children({ browse })}
      {#if progress}
        <SpinLoader />
        <span aria-live="polite">{@render uploading(progress)}</span>
      {:else}
        <Upload size={18} />
        <span>
          {many ? t__('common.drop_files') : t__('common.drop_file')}
          {t__('common.or')}
          <button type="button" class="rz-file-drop__link" onclick={browse}>
            {t__('common.browse')}
          </button>
        </span>
        {#if accept?.length}
          <small>{acceptLabel(accept, t__('common.or'))}</small>
        {/if}
      {/if}
    {/snippet}
  </FileDrop>
  {#if failed.length}
    <p class="rz-relation-upload__failed">{t__('fields.upload_failed', failed.join(', '))}</p>
  {/if}
{/if}

{#if many}
  {#key stamp}
    <div bind:this={list} class="rz-relation-upload__list" data-error={hasError ? '' : null}>
      {#each selectedItems as item (item.documentId)}
        <div class="rz-relation-upload__thumb" title={item.title}>
          <a
            href={panelPath(relationConfig.kebab, item.documentId)}
            aria-label={item.title}
            draggable="false"
          >
            {#if item.isImage && item.url}
              <img src={item.url} alt="" draggable="false" />
            {:else}
              <span class="rz-relation-upload__type">{typeLabel(item.mimeType)}</span>
            {/if}
          </a>
          {#if !readOnly}
            <button
              type="button"
              class="rz-relation-upload__remove"
              aria-label={t__('fields.remove_item', item.title)}
              onclick={() => removeValue(item.documentId)}
            >
              <X size={11} />
            </button>
          {/if}
        </div>
      {/each}
      {#each { length: slots }, index (index)}
        <div class="rz-relation-upload__slot" aria-hidden="true"></div>
      {/each}
    </div>
  {/key}
{/if}

<Browse
  bind:open={browsing}
  config={relationConfig}
  {many}
  {selected}
  nestedLevel={formNestedLevel + 1}
  onChange={setValue}
  onCreating={(creating) => (creating ? onRelationCreation() : onRelationCreationCanceled())}
/>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  :global(.rz-relation-upload__drop[data-error]) {
    border-color: var(--rz-danger);
  }

  /* Narrow, in a side panel: the zone on one line, the card's image smaller. */
  @container rz-field-root (max-width: 20rem) {
    :global(.rz-relation-upload__drop) {
      flex-direction: row;
      flex-wrap: wrap;
      gap: var(--rz-size-2);
      padding: var(--rz-size-3);
    }
    :global(.rz-relation-upload__drop > svg) {
      margin: 0;
    }
    :global(.rz-relation-upload__drop small) {
      flex-basis: 100%;
    }
    .rz-relation-upload__card-thumb {
      width: var(--rz-size-11);
      height: var(--rz-size-11);
    }
  }

  /*
   * One pick, in the zone's place: the media's image, its name and size, then its actions, on a
   * well with a hairline. `div.` outweighs the zone's own look.
   */
  :global(div.rz-file-drop.rz-relation-upload__card) {
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--rz-size-3);
    padding: var(--rz-size-2);
    border: 0;
    border-radius: var(--rz-radius-lg);
    box-shadow: inset 0 0 0 1px var(--rz-border);
    color: var(--rz-fg);
    text-align: left;
  }

  :global(div.rz-file-drop.rz-relation-upload__card[data-over]) {
    box-shadow: inset 0 0 0 1px var(--rz-accent-border);
  }

  .rz-relation-upload__card-thumb {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: var(--rz-size-14);
    height: var(--rz-size-14);
    overflow: hidden;
    border-radius: var(--rz-radius-md);
    background-color: var(--rz-bg-well);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-relation-upload__card-info {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-0-5);
    flex: 1;
    min-width: 0;
  }

  .rz-relation-upload__card-name {
    @mixin font-medium;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    &:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    &:focus-visible {
      @mixin focus-ring;
      border-radius: var(--rz-radius-sm);
    }
  }

  .rz-relation-upload__card-meta {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  .rz-relation-upload__card-actions {
    display: flex;
    gap: var(--rz-size-0-5);

    button {
      display: grid;
      place-items: center;
      width: var(--rz-size-7);
      height: var(--rz-size-7);
      border-radius: var(--rz-radius-sm);
      color: var(--rz-fg-muted);
      &:hover {
        background-color: var(--rz-bg-hover);
        color: var(--rz-fg);
      }
      &:focus-visible {
        @mixin focus-ring;
      }
    }
  }

  /* A file over the card: the image dims, "Drop to replace" takes the name's place. */
  .rz-relation-upload__card-drop {
    display: none;
    align-items: center;
    gap: var(--rz-size-2);
    flex: 1;
    color: var(--rz-accent-text);
    @mixin font-medium;
  }

  :global(.rz-relation-upload__card[data-over]) {
    .rz-relation-upload__card-drop {
      display: flex;
    }
    .rz-relation-upload__card-info,
    .rz-relation-upload__card-actions {
      display: none;
    }
    .rz-relation-upload__card-thumb {
      opacity: 0.45;
    }
  }

  .rz-relation-upload__failed {
    margin-top: var(--rz-size-1-5);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
  }

  /* Five squares to a row, each up to 5rem, shrinking together on a narrow field. */
  .rz-relation-upload__list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, var(--rz-size-20)));
    gap: var(--rz-size-2);
    margin-top: var(--rz-size-2);
  }

  .rz-relation-upload__list:not(:has(.rz-relation-upload__thumb)) {
    display: none;
  }

  .rz-relation-upload__thumb,
  .rz-relation-upload__slot {
    aspect-ratio: 1;
    border-radius: var(--rz-radius-lg);
    background-color: var(--rz-bg-well);
  }

  .rz-relation-upload__thumb {
    position: relative;
    overflow: hidden;

    /* A hairline over the image, so a light one keeps its edge. */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px var(--rz-border);
      pointer-events: none;
    }

    a {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      &:focus-visible {
        @mixin focus-ring;
        outline-offset: -2px;
      }
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
  }

  .rz-relation-upload__list .rz-relation-upload__thumb {
    cursor: grab;
  }

  .rz-relation-upload__type {
    color: var(--rz-fg-subtle);
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    letter-spacing: 0.04em;
    @mixin font-semibold;
  }

  .rz-relation-upload__remove {
    @mixin surface float;
    position: absolute;
    z-index: 1;
    top: var(--rz-size-1);
    right: var(--rz-size-1);
    display: grid;
    place-items: center;
    width: var(--rz-size-5);
    height: var(--rz-size-5);
    border-radius: var(--rz-radius-sm);
    color: var(--rz-fg);
    opacity: 0;
    transition: opacity 0.15s;

    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-relation-upload__thumb:hover .rz-relation-upload__remove,
  .rz-relation-upload__thumb:focus-within .rz-relation-upload__remove {
    opacity: 1;
  }

  @media (hover: none) {
    .rz-relation-upload__remove {
      opacity: 1;
    }
  }
</style>
