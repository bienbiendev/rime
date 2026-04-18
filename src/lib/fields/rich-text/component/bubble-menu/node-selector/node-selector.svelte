<script module lang="ts">
  import type { RichTextFeatureNode } from '$lib/fields/rich-text/core/types.js';
  export type NodeSelectorItem = RichTextFeatureNode & { name: string; options?: any };
</script>

<script lang="ts">
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as Popover from '$lib/panel/components/ui/popover/index.js';
  import { Asterisk, Check, ChevronDown } from '@lucide/svelte';
  import type { Editor } from '@tiptap/core';
  import { onDestroy, onMount } from 'svelte';
  import './node-selector.css';

  type Props = { editor: Editor; isMenuOpen: boolean; items: NodeSelectorItem[] };
  let { editor, items, isMenuOpen }: Props = $props();

  let open = $state(false);

  let activeItems = $state<Record<string, boolean>>({});
  const activeItem = $derived.by(getActiveItem);

  function getActiveItem() {
    // Count active items
    const activeCount = Object.values(activeItems).filter(Boolean).length;
    if (activeCount === 1) {
      // Find the active item name
      const activeItemName = Object.keys(activeItems).find((name) => activeItems[name]);
      // Return the matching item or default to paragraph
      return (
        items.find((item) => item.name === activeItemName) || {
          name: 'paragraph',
          label: 'Paragraph',
          icon: Asterisk
        }
      );
    } else if (activeCount > 1) {
      return { name: 'multiple', label: 'Multiple', icon: Asterisk };
    } else {
      // Default to paragraph when nothing is active
      return { name: 'paragraph', label: 'Paragraph', icon: Asterisk };
    }
  }

  function setActiveItems() {
    // Update active states for all items
    activeItems = items.reduce(
      (acc, item) => {
        acc[item.name] = item.isActive?.({ editor }) || false;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  onMount(() => {
    editor.on('update', setActiveItems);
    editor.on('selectionUpdate', setActiveItems);
    setActiveItems();
  });

  onDestroy(() => {
    editor.off('update', setActiveItems);
    editor.off('selectionUpdate', setActiveItems);
  });

  $effect(() => {
    if (!isMenuOpen) {
      open = false;
    }
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger class="rz-node-selector__trigger" type="button">
    {#snippet child({ props })}
      <Button size="sm" variant="ghost" {...props}>
        {activeItem.label || activeItem.name}
        <ChevronDown size={16} />
      </Button>
    {/snippet}
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Content align="start" class="rz-node-selector__content">
      {#each items as item, index (index)}
        {@const ItemIcon = item.icon}
        <button
          onclick={() => {
            if (item.nodeSelector && item.nodeSelector.command) {
              item.nodeSelector.command({ editor });
            }
            open = false;
          }}
          class="rz-node-selector__node"
          type="button"
        >
          <div class="rz-node-selector__node-content">
            <div class="rz-node-selector__node-icon">
              <ItemIcon size={15} />
            </div>
            <span>{item.label || item.name}</span>
          </div>

          {#if activeItems[item.name]}
            <Check size={16} />
          {/if}
        </button>
      {/each}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
