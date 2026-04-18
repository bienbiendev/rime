<script lang="ts">
  import { GripVertical } from '@lucide/svelte';
  import type { Editor } from '@tiptap/core';
  import {
    DragHandlePlugin,
    defaultComputePositionConfig,
    type DragHandlePluginProps
  } from '../../core/extensions/drag-handle/index.js';
  import './drag-handle.css';

  type Props = {
    editor: Editor;
    element?: HTMLElement;
    computePositionConfig?: DragHandlePluginProps['computePositionConfig'];
  };

  let { editor, computePositionConfig, element = $bindable() }: Props = $props();

  const pluginKey = new Date().getTime().toString();

  $effect(() => {
    if (!element || !editor) return;
    const { plugin } = DragHandlePlugin({
      editor,
      pluginKey,
      element,
      computePositionConfig: { ...defaultComputePositionConfig, ...computePositionConfig }
    });
    editor.registerPlugin(plugin);
    return () => editor.unregisterPlugin(pluginKey);
  });
</script>

<div bind:this={element} class="rz-rich-text-drag-handle">
  <GripVertical size="14" />
</div>
