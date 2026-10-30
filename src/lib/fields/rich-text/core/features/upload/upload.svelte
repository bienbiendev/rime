<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { UploadDoc } from '#lib/core/prototype/collection/upload/types.js';
  import UploadThumbCell from '#lib/panel/components/sections/collection/upload-thumb-cell/UploadThumbCell.svelte';
  import { mediaMeta } from '#lib/panel/util/upload-file.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import PickDialog from '../pick-dialog.svelte';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import Input from '#lib/panel/components/ui/input/input.svelte';
  import { getConfigContext } from '#lib/panel/context/config.svelte.js';
  import { useCandidates } from '#lib/panel/util/candidates.svelte.js';
  import X from '@lucide/svelte/icons/x';
  import type { NodeViewProps } from '@tiptap/core';
  import { onMount } from 'svelte';
  import NodeViewWrapper from '../../svelte/node-view-wrapper.svelte';
  import './upload.css';

  type NodeAttributes = {
    id: string | null;
    title: string | null;
    sizes?: Record<string, any> | null;
    mimeType: string | null;
    url: string | null;
    filename: string | null;
    legend: string;
    _fresh: boolean;
  };

  let { node, updateAttributes, extension }: NodeViewProps = $props();
  let isDialogOpen = $state(false);
  let dialogLegendOpen = $state(false);

  // What the node holds: the media, or null when none is picked yet
  const selected = $derived<Omit<NodeAttributes, 'legend' | '_fresh'> | null>(
    node.attrs.id
      ? {
          id: node.attrs.id,
          title: node.attrs.title,
          url: node.attrs.url,
          sizes: node.attrs.sizes,
          mimeType: node.attrs.mimeType,
          filename: node.attrs.filename
        }
      : null
  );
  const legend = $derived<string>(node.attrs.legend || '');

  const handleClick = () => {
    isDialogOpen = true;
  };

  // A node just inserted opens its picker, once
  onMount(() => {
    if (node.attrs._fresh) {
      isDialogOpen = true;
      updateAttributes({ _fresh: false });
    }
  });

  const { getCollection } = getConfigContext();
  // svelte-ignore state_referenced_locally
  const [slug, query] = extension.options.source.split('?');
  let search = $state('');

  /** The media the dialog offers, read while it is open. */
  const found = useCandidates(() => ({
    open: isDialogOpen,
    config: getCollection(slug),
    query,
    search
  }));

  // The picked media replaces the node's, without a legend
  function pickMedia(doc: UploadDoc) {
    isDialogOpen = false;
    const { id, title, url, sizes, mimeType, filename } = doc;
    updateAttributes({ id, title, url, sizes, mimeType, filename, legend: null, _fresh: false });
  }

  // The node keeps its place and holds no media
  function removeMedia() {
    updateAttributes({
      id: null,
      title: null,
      url: null,
      sizes: null,
      mimeType: null,
      filename: null,
      legend: null,
      _fresh: false
    });
  }
</script>

<NodeViewWrapper>
  <div data-drag-handle class="rz-richtext-media" class:rz-richtext-media--selected={!!selected}>
    {#if !selected}
      <Button class="rz-richtext-media__add" variant="outline" onclick={handleClick}>
        {t__('fields.rich_text_add_media')}
      </Button>
    {:else}
      <div class="rz-richtext-media__actions">
        <Button
          size="xs"
          class="rz-richtext-media__button"
          type="button"
          onclick={() => (dialogLegendOpen = true)}
        >
          {legend || t__('fields.rich_text_set_legend')}
        </Button>
        <Button
          size="icon-sm"
          class="rz-richtext-media__button rz-richtext-media__button-remove"
          type="button"
          onclick={removeMedia}
        >
          <X size="12" />
        </Button>
      </div>
      {@render media(selected)}
      {#if legend}
        <p class="rz-richtext-media__legend">{legend}</p>
      {/if}
    {/if}
  </div>
</NodeViewWrapper>

{#snippet dialogItem(item: UploadDoc)}
  <div class="rz-relation-upload__grid-item">
    <div class="rz-relation-upload__grid-thumbnail" style="--rz-upload-preview-cell-size: 100%">
      <UploadThumbCell url={item._thumbnail} mimeType={item.mimeType} />
    </div>
    <div class="rz-relation-upload__grid-info">
      <p class="rz-relation-upload__grid-filename">{item.filename}</p>
      <p class="rz-relation-upload__grid-filesize">{mediaMeta(item)}</p>
    </div>
  </div>
{/snippet}

{#snippet media(attributes: Omit<NodeAttributes, 'legend' | '_fresh'>)}
  <div class="rz-richtext-media__media">
    {#if attributes.mimeType?.includes('image')}
      <img src={attributes.url} alt={legend} />
    {:else if attributes.mimeType?.includes('video')}
      <video muted src={attributes.url}></video>
    {/if}
  </div>
{/snippet}

<PickDialog
  bind:open={isDialogOpen}
  bind:search
  items={(found.docs ?? []) as UploadDoc[]}
  count={found.count}
  label={(doc) => doc.filename}
  onPick={pickMedia}
  row={dialogItem}
/>

<Dialog.Root bind:open={dialogLegendOpen}>
  <Dialog.Content>
    <Dialog.Title>{t__('fields.rich_text_media_legend')}</Dialog.Title>
    <Input value={legend} oninput={(e) => updateAttributes({ legend: e.currentTarget.value })} />
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  @import '../../../../../panel/style/mixins/index.css';

  :global(.ProseMirror-selectednode .rz-richtext-media) {
    .rz-richtext-media__media,
    :global(button.rz-richtext-media__add) {
      @mixin focus-ring;
    }
    .rz-richtext-media__actions {
      display: flex;
    }
  }

  .rz-richtext-media {
    position: relative;
  }

  .rz-richtext-media__media {
    border-radius: var(--rz-radius-lg);
    overflow: hidden;
  }
  .rz-richtext-media__actions {
    position: absolute;
    font-size: var(--rz-text-sm);
    right: var(--rz-size-3);
    top: var(--rz-size-3);
    display: none;
    gap: var(--rz-size-2);

    :global {
      .rz-richtext-media__button.rz-richtext-media__button-remove {
        width: var(--rz-size-5);
        padding: 0;
      }
      .rz-richtext-media__button {
        border: 1px solid var(--foreground);
        border-radius: 1rem;
        height: var(--rz-size-5);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  .rz-richtext-media__legend {
    font-style: italic;
    font-size: var(--rz-text-sm);
    opacity: 0.5;
  }
</style>
