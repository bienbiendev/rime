<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import { Editor, getSchema, type JSONContent } from '@tiptap/core';
  import { onMount } from 'svelte';
  import EditorBubbleMenu from '../component/bubble-menu/bubble-menu.svelte';
  import { createRichTextState } from '../component/context.svelte.js';
  import DragHandler from '../component/drag-handle/drag-handle.svelte';
  import '../component/styles/editor.css';
  import Suggestion from '../component/suggestion/suggestion.svelte';
  import { hasSuggestion } from '../util.js';
  import { buildEditorConfig } from './build-editor-config.js';
  import { editorContent } from './content.js';
  import { defaultFeatures } from './features/index.js';
  import type { RichTextFeature } from './types.js';

  type Props = {
    path: string;
    features?: RichTextFeature[];
    value?: JSONContent | string | null;
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

  const ctx = createRichTextState();

  const withSuggestion = $derived(hasSuggestion(wanted));

  /** The node and mark types of the value that the features do not register. */
  let unsupported = $state<string[]>([]);

  // The editor starts with its content, and goes with the component. A value it cannot hold
  // whole stays read-only, so no edit saves over it.
  onMount(() => {
    const richTextEditorConfig = buildEditorConfig({ features: wanted });
    features = richTextEditorConfig.features;
    const opened = editorContent(value, getSchema(richTextEditorConfig.tiptap.extensions ?? []));
    unsupported = opened.unsupported;
    editor = new Editor({
      ...richTextEditorConfig.tiptap,
      element,
      editable: editable && !unsupported.length,
      content: opened.doc
    });

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
    const opened = editorContent(value, editor.schema);
    // Read from `opened`, not the state: reading `unsupported` here would rerun this effect
    unsupported = opened.unsupported;
    // `false`: switching back to editable emits no update, which would save the opened copy
    editor.setEditable(editable && !opened.unsupported.length, false);
    editor.commands.setContent(opened.doc ?? '', { emitUpdate: false });
  });
</script>

<!-- The editor and its controls, over a value: what a field and an in-place text share. -->
<div class="rz-rich-text__editor-wrapper">
  <div
    bind:this={element}
    data-error={error ? 'true' : null}
    class="rz-rich-text__editor {className ?? ''}"
  ></div>

  {#if unsupported.length}
    <p class="rz-rich-text__unsupported">
      {t__('fields.rich_text_unsupported', unsupported.join(', '))}
    </p>
  {/if}

  {#if editor && editor.isEditable && !unsupported.length}
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

  .rz-rich-text__unsupported {
    margin-top: var(--rz-size-2);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
  }
</style>
