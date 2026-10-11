<script lang="ts">
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
  let selected = $state<RichTextResource | null>();

  const handleClick = () => {
    isDialogOpen = true;
  };

  onMount(() => {
    if (node.attrs.id) {
      selected = {
        id: node.attrs.id,
        title: node.attrs.title,
        _type: node.attrs._type,
        _thumbnail: node.attrs._thumbnail
      };
    } else {
      selected = null;
    }
    // A node just inserted opens its dialog.
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

  // Handle dialog selection
  function handleResourceSelection(doc: RequiredNodeAttributes) {
    isDialogOpen = false;
    selected = doc;
    updateNodeAttributes();
  }

  // Handle removing resource
  function removeResource() {
    selected = null;
    // Update node attributes with empty values
    updateAttributes({
      id: null,
      title: null,
      _type: null,
      _thumbnail: null,
      _fresh: false
    });
  }

  // Update node attributes based on current state
  function updateNodeAttributes() {
    if (!selected) return;

    updateAttributes({
      id: selected.id,
      title: selected.title,
      _type: selected._type,
      _thumbnail: selected._thumbnail,
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
        Add a resource
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
