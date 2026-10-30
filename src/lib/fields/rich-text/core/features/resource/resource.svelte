<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { GenericDoc } from '#lib/core/prototype/types.js';
  import { apiUrl } from '#lib/core/routes/util.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import CardResource from '#lib/panel/components/ui/card-resource/card-resource.svelte';
  import PickDialog from '../pick-dialog.svelte';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import type { NodeViewProps } from '@tiptap/core';
  import { onMount } from 'svelte';
  import NodeViewWrapper from '../../svelte/node-view-wrapper.svelte';
  import type { RichTextResource } from './types';

  type RequiredNodeAttributes = {
    id: string;
    title: string;
    _type: string;
  };

  let { node, updateAttributes, extension }: NodeViewProps = $props();
  let isDialogOpen = $state(false);

  // What the node holds: the document, or null when none is picked yet
  const selected = $derived<RichTextResource | null>(
    node.attrs.id
      ? {
          id: node.attrs.id,
          title: node.attrs.title,
          _type: node.attrs._type,
          _thumbnail: node.attrs._thumbnail
        }
      : null
  );

  const handleClick = () => {
    isDialogOpen = true;
  };

  // A node just inserted opens its dialog
  onMount(() => {
    if (node.attrs._fresh) {
      isDialogOpen = true;
    }
  });

  const APIProxy = getAPIProxyContext();

  // svelte-ignore state_referenced_locally
  const url = apiUrl(extension.options.source);

  const ressource = APIProxy.getRessource<{ docs: GenericDoc[] }>(url);
  let docs = $state<GenericDoc[]>([]);

  $effect(() => {
    if (ressource.data) {
      docs = ressource.data.docs;
    }
  });

  // The picked document replaces the node's
  function handleResourceSelection(doc: GenericDoc) {
    isDialogOpen = false;
    const { id, title, _type, _thumbnail } = doc;
    updateAttributes({ id, title, _type, _thumbnail, _fresh: false });
  }

  // The node keeps its place and holds no document
  function removeResource() {
    updateAttributes({
      id: null,
      title: null,
      _type: null,
      _thumbnail: null,
      _fresh: false
    });
  }
</script>

<NodeViewWrapper>
  <div
    data-drag-handle
    class="rz-richtext-resource"
    class:rz-richtext-resource--selected={!!selected}
  >
    {#if !selected}
      <Button class="rz-richtext-resource__add" variant="outline" size="sm" onclick={handleClick}>
        {t__('fields.rich_text_add_resource')}
      </Button>
    {:else}
      <CardResource resource={selected as RequiredNodeAttributes} onCloseClick={removeResource} />
    {/if}
  </div>
</NodeViewWrapper>

<PickDialog
  bind:open={isDialogOpen}
  items={docs}
  label={(doc) => doc.title}
  onPick={handleResourceSelection}
/>

<style lang="postcss">
  @import '../../../../../panel/style/mixins/index.css';

  :global(.ProseMirror-focused .ProseMirror-selectednode .rz-richtext-resource) {
    :global(.rz-card-resource),
    :global(button.rz-richtext-resource__add) {
      @mixin focus-ring;
    }
  }
  .rz-richtext-resource {
    position: relative;
    --rz-border-radius: var(--rz-radius-xl);
    --rz-ressource-card-thumbnail-bg: var(--rz-bg-well);
    --rz-ressource-card-bg: var(--rz-bg-raised);
  }
</style>
