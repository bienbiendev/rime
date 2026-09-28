<script lang="ts">
  import * as random from '$lib/util/random.js';
  import { Editor, type JSONContent } from '@tiptap/core';
  import { onMount } from 'svelte';
  import EditorBubbleMenu from '../component/bubble-menu/bubble-menu.svelte';
  import { setRichTextContext } from '../component/context.svelte.js';
  import DragHandler from '../component/drag-handle/drag-handle.svelte';
  import '../component/styles/editor.css';
  import Suggestion from '../component/suggestion/suggestion.svelte';
  import { hasSuggestion } from '../util.js';
  import { buildEditorConfig } from './build-editor-config.js';
  import { defaultFeatures } from './features/index.js';
  import type { RichTextFeature } from './types.js';

  type Props = {
    path: string;
    features?: RichTextFeature[];
    value?: JSONContent | null;
    editable?: boolean;
    error?: boolean;
    class?: string;
    onUpdate?: (json: JSONContent) => void;
  };

  const {
    path,
    features: wanted = defaultFeatures,
    value,
    editable = true,
    error = false,
    class: className,
    onUpdate
  }: Props = $props();

  let element: HTMLElement;

  let editor = $state<Editor>();
  let features = $state<RichTextFeature[]>([]);
  const instanceId = random.randomId(8);

  const ctx = setRichTextContext(instanceId);

  const withSuggestion = $derived(hasSuggestion(wanted));

  // The editor starts with its content, and goes with the component.
  onMount(() => {
    const richTextEditorConfig = buildEditorConfig({ features: wanted });
    features = richTextEditorConfig.features;
    const options = { ...richTextEditorConfig.tiptap, element, editable };

    try {
      editor = new Editor({ ...options, content: value?.content ? value : undefined });
    } catch (err) {
      console.log(err);
      editor = new Editor(options);
    }

    editor.on('update', ({ editor }) => {
      onUpdate?.(editor.getJSON());
    });

    return () => editor?.destroy();
  });

  // The value changed outside this editor: another editor on the same path, a pasted block.
  // The editor's own updates land here equal to its content and change nothing.
  $effect(() => {
    if (!editor) return;
    if (JSON.stringify(value ?? null) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(value?.content ? value : '', { emitUpdate: false });
  });
</script>

<!-- The editor and its controls, over a value: what a field and an in-place text share. -->
<div class="rz-rich-text__editor-wrapper">
  <div
    bind:this={element}
    data-error={error ? 'true' : null}
    class="rz-rich-text__editor {className ?? ''}"
  ></div>

  {#if editor && editor.isEditable}
    <DragHandler {editor} />

    {#if withSuggestion}
      <Suggestion {editor} {features} />
    {/if}

    <EditorBubbleMenu {features} {editor} {path} context={ctx} />
  {/if}
</div>

<style type="postcss">
  .rz-rich-text__editor-wrapper {
    position: relative;

    :global {
      .ProseMirror-gapcursor:after {
        border-top: 1px solid var(--rz-fg);
      }
    }
  }
</style>
