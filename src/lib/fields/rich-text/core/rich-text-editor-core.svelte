<script lang="ts">
  import EditorBubbleMenu from '../component/bubble-menu/bubble-menu.svelte';
  import { setRichTextContext } from '../component/context.svelte.js';
  import DragHandler from '../component/drag-handle/drag-handle.svelte';
  import { random } from '$lib/util/index.js';
  import { Editor, type JSONContent } from '@tiptap/core';
  import { onMount } from 'svelte';
  import { buildEditorConfig } from './build-editor-config.js';
  import { defaultFeatures } from './features/index.js';
  import type { RichTextFeature } from './types.js';
  import { hasSuggestion } from '../util.js';
  import Suggestion from '../component/suggestion/suggestion.svelte';

  type Props = {
    path: string;
    features?: RichTextFeature[];
    value?: JSONContent;
    editable?: boolean;
    class?: string;
    /** Strip NodeViews for features that define one (fields/resource/upload) — schema stays
     * intact so the doc still parses, they just render statically instead of interactively. */
    stripNonFlowNodeViews?: boolean;
    /** Re-apply `value` into the editor when it changes after mount (e.g. sidebar edits
     * arriving via the live store). Off by default — a form-bound `value` (like the panel's)
     * changes on every keystroke as a direct echo of this editor's own `onUpdate`, and
     * resyncing that back in would just fight the user's typing. */
    syncExternalValue?: boolean;
    /** The Cmd+K slash-command menu. On by default; the live wrapper turns it off — its
     * positioning assumes the full panel viewport and breaks inside the iframe. */
    enableSuggestion?: boolean;
    /** Render dropdowns (node selector) inline instead of portalling to document.body —
     * needed in the live iframe, where portalled content would escape the injected scoped styles. */
    disablePortals?: boolean;
    onUpdate?: (json: JSONContent) => void;
    /** Fired when the user clicks a node whose NodeView was stripped. */
    onNonFlowNodeClick?: (nodeType: string) => void;
    [key: `data-${string}`]: string | null | undefined;
  };

  const {
    path,
    features: featuresProp,
    value,
    editable = true,
    class: className,
    stripNonFlowNodeViews = false,
    syncExternalValue = false,
    enableSuggestion = true,
    disablePortals = false,
    onUpdate,
    onNonFlowNodeClick,
    ...rest
  }: Props = $props();

  let element: HTMLElement;
  const key = $derived(`richtext-${path}`);

  let editor = $state<Editor>();
  let features = $state<RichTextFeature[]>([]);
  let strippedNodeTypeNames = $state<Set<string>>(new Set());
  const instanceId = random.randomId(8);

  const ctx = setRichTextContext(instanceId);

  const withSuggestion = $derived(
    enableSuggestion && hasSuggestion(featuresProp || defaultFeatures)
  );

  onMount(() => {
    const richTextEditorConfig = buildEditorConfig({
      features: featuresProp || defaultFeatures,
      stripNonFlowNodeViews
    });

    features = richTextEditorConfig.features;
    strippedNodeTypeNames = richTextEditorConfig.strippedNodeTypeNames;

    editor = new Editor({
      ...richTextEditorConfig.tiptap,
      element,
      editable
    });

    if (value?.content) {
      try {
        // emitUpdate: false — seeding initial content isn't a user edit, don't fire onUpdate for it
        editor.commands.setContent(value.content, { emitUpdate: false });
      } catch (err) {
        editor.commands.setContent('', { emitUpdate: false });
        console.log(err);
      }
    }

    editor.on('update', ({ editor }) => {
      onUpdate?.(editor.getJSON());
    });
  });

  $effect(() => {
    if (!syncExternalValue || !editor) return;
    // Cross-frame focus doesn't reliably clear (each frame keeps its own activeElement), so
    // isFocused can't be trusted as a "don't fight the user's typing" guard here. Compare
    // content instead — safe to re-apply either way since emitUpdate:false can't loop.
    const incoming = value?.content ?? '';
    if (JSON.stringify(incoming) === JSON.stringify(editor.getJSON().content)) return;
    try {
      editor.commands.setContent(incoming, { emitUpdate: false });
    } catch (err) {
      console.log(err);
    }
  });

  function onClick(e: MouseEvent) {
    if (!editor || strippedNodeTypeNames.size === 0 || !onNonFlowNodeClick) return;
    const target = e.target as HTMLElement;
    const pos = editor.view.posAtDOM(target, 0);
    const resolved = editor.state.doc.resolve(pos);
    const node = resolved.nodeAfter || resolved.nodeBefore || resolved.parent;
    if (node && strippedNodeTypeNames.has(node.type.name)) {
      e.preventDefault();
      e.stopPropagation();
      onNonFlowNodeClick(node.type.name);
    }
  }
</script>

<div class="rz-rich-text-editor-core__wrapper">
  <div
    bind:this={element}
    class="rz-rich-text-editor-core__content {className}"
    onclickcapture={onClick}
    {...rest}
  ></div>

  {#if editor && editor.isEditable}
    <DragHandler {editor} />

    {#if withSuggestion}
      <Suggestion {editor} {features} />
    {/if}

    {#key key}
      <EditorBubbleMenu {features} {editor} {path} context={ctx} {disablePortals} />
    {/key}
  {/if}
</div>

<style>
  .rz-rich-text-editor-core__wrapper {
    position: relative;
  }

  :global(.ProseMirror-gapcursor:after) {
    border-top: 1px solid currentColor;
  }
</style>
