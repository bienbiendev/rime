<script lang="ts">
  import GripVertical from '@lucide/svelte/icons/grip-vertical';
  import type { Editor } from '@tiptap/core';
  import {
    DragHandlePlugin,
    defaultComputePositionConfig
  } from '../../core/extensions/drag-handle/index.js';
  import './drag-handle.css';

  type Props = {
    editor: Editor;
  };

  let { editor }: Props = $props();
  let element = $state<HTMLElement>();

  const pluginKey = new Date().getTime().toString();

  $effect(() => {
    if (!element || !editor) return;
    const { plugin, unbind } = DragHandlePlugin({
      editor,
      pluginKey,
      element,
      computePositionConfig: defaultComputePositionConfig
    });
    editor.registerPlugin(plugin);
    return () => {
      unbind();
      editor.unregisterPlugin(pluginKey);
    };
  });
</script>

<div bind:this={element} class="rz-rich-text-drag-handle">
  <GripVertical size="14" />
</div>
