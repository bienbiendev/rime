<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
  import { onDestroy, onMount } from 'svelte';
  import type {
    RichTextFeature,
    RichTextFeatureMark,
    RichTextFeatureNode
  } from '../../core/types.js';
  import { getRichTextContext } from '../context.svelte';
  import './bubble-menu.css';
  import IconButton from './icon-button/icon-button.svelte';
  import NodeSelector, { type NodeSelectorItem } from './node-selector/node-selector.svelte';

  type BubbleMenuItem = (RichTextFeatureMark | RichTextFeatureNode) & {
    name: string;
    options?: any;
  };

  type Props = {
    editor: Editor;
    features: RichTextFeature[];
    path: string;
  };

  const { editor, path, features = [] }: Props = $props();

  let element: HTMLElement;
  let isOpen = $state(false);

  // Get all node selector items from features
  const getNodeItems = (nodes: any[], feature: any): NodeSelectorItem[] =>
    nodes
      .map((node) => ({
        ...node,
        name: node.label,
        options: feature.extension?.options
      }))
      .filter((node) => !!node.nodeSelector);

  const nodeItems = $derived(
    features.flatMap((feature) => getNodeItems(feature.nodes || [], feature))
  );

  // Get all items with bubble menu components (both nodes and marks)
  const getBubbleMenuItems = (items: any[], feature: any): BubbleMenuItem[] =>
    items
      .map((item) => ({
        ...item,
        name: item.label,
        options: feature.extension?.options
      }))
      .filter((item) => !!item.name)
      .filter((item) => !!item.bubbleMenu);

  const bubbleMenuItems = $derived([
    ...features.flatMap((feature) => getBubbleMenuItems(feature.marks || [], feature)),
    ...features.flatMap((feature) => getBubbleMenuItems(feature.nodes || [], feature))
  ]);

  const pluginKey = $derived(path);
  const updateDelay = 250;
  const richTextContext = $derived(getRichTextContext(path));

  const shouldShow = ({ editor }: { editor: Editor }) => {
    return (
      editor.view.state.selection.$head.depth > 0 && editor.view.state.selection.content().size > 0
    );
  };

  function setActiveItems() {
    activeItems = bubbleMenuItems.reduce(
      (acc, item) => {
        acc[item.name] = item.isActive?.({ editor }) || false;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  onMount(() => {
    const plugin = BubbleMenuPlugin({
      pluginKey,
      editor,
      element,
      shouldShow,
      updateDelay,
      options: {
        onShow() {
          richTextContext.bubbleOpen = true;
          isOpen = true;
        },
        onHide() {
          richTextContext.bubbleOpen = false;
          isOpen = false;
        }
      }
    });

    editor.registerPlugin(plugin);
    editor.on('selectionUpdate', setActiveItems);
    setActiveItems();
  });

  onDestroy(() => {
    editor.off('selectionUpdate', setActiveItems);
    editor.unregisterPlugin(pluginKey);
  });

  let activeItems = $state<Record<string, boolean>>({});
</script>

<div
  id={pluginKey}
  bind:this={element}
  class="rz-bubble-menu {isOpen ? 'rz-bubble-menu--open' : ''}"
>
  {#if nodeItems.length > 1}
    <NodeSelector {editor} items={nodeItems} isMenuOpen={isOpen} />
  {/if}

  {#if bubbleMenuItems.length > 0}
    {#each bubbleMenuItems as item, index (index)}
      {#if item.bubbleMenu && item.bubbleMenu.component}
        {@const FeatureComponent = item.bubbleMenu.component}
        <FeatureComponent
          active={activeItems[item.name]}
          options={item.options}
          {editor}
          {path}
          context={richTextContext}
        />
      {:else if item.bubbleMenu?.command}
        <IconButton
          active={activeItems[item.name]}
          icon={item.icon}
          onclick={() => {
            item.bubbleMenu?.command?.({ editor });
            // Update active state after command execution
            activeItems[item.name] = item.isActive?.({ editor }) || false;
          }}
        />
      {/if}
    {/each}
  {/if}
</div>

<style>
  .rz-bubble-menu {
    opacity: 0;
    pointer-events: none;
    &.rz-bubble-menu--open {
      opacity: 1;
      pointer-events: all;
    }
  }
</style>
