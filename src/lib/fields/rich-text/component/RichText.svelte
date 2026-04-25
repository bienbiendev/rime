<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import { Editor, type JSONContent } from '@tiptap/core';
  import { onMount } from 'svelte';
  import { buildEditorConfig } from '../core/build-editor-config.js';
  import type { RichTextFeature } from '../core/types';
  import { hasSuggestion } from '../util.js';
  import EditorBubbleMenu from './bubble-menu/bubble-menu.svelte';
  import { setRichTextContext } from './context.svelte.js';
  import DragHandler from './drag-handle/drag-handle.svelte';
  import type { RichTextFieldProps } from './props.js';
  import './styles/rich-text.css';
  import Suggestion from './suggestion/suggestion.svelte';

  const { path, config, form, standAlone, class: className }: RichTextFieldProps = $props();

  let element: HTMLElement;
  const key = $derived(`richtext-${path}`);

  let editor = $state<Editor>();
  let features = $state<RichTextFeature[]>([]);
  const field = $derived(form.useField<JSONContent>(path, config));

  $effect(() => {
    setRichTextContext(path);
  });

  const withSuggestion = $derived(hasSuggestion(config.features || []));

  onMount(() => {
    // Build editor configuration
    const richTextEditorConfig = buildEditorConfig({ features: config.features });

    features = richTextEditorConfig.features;
    editor = new Editor({
      ...richTextEditorConfig.tiptap,
      element,
      editable: field.editable
    });

    if (field.value?.content) {
      try {
        editor.commands.setContent(field.value.content);
      } catch (err) {
        editor.commands.setContent('');
        console.log(err);
      }
    }

    // Update field value when editor content changes
    editor.on('update', ({ editor }) => {
      field.value = editor.getJSON();
    });
  });
</script>

<fieldset
  class:rz-field-rich-text--standalone={standAlone}
  class="rz-field-rich-text {config.className || ''}"
  use:root={field}
>
  <Field.Label {config} for={path || config.name} />

  <Field.Error error={field.error} />

  <div class="rz-rich-text__editor-wrapper">
    <div
      bind:this={element}
      data-error={field.error ? 'true' : null}
      class="rz-rich-text__editor {className}"
    ></div>

    {#if editor && editor.isEditable}
      <DragHandler {editor} />

      {#if withSuggestion}
        <Suggestion {editor} {features} />
      {/if}

      {#key key}
        <EditorBubbleMenu {features} {editor} {path} />
      {/key}
    {/if}
  </div>

  {#if !standAlone}
    <Field.Hint {config} />
  {/if}
</fieldset>

<style type="postcss">
  .rz-rich-text__editor-wrapper {
    position: relative;
  }

  .rz-field-rich-text {
    :global {
      .ProseMirror-gapcursor:after {
        border-top: 1px solid hsl(var(--rz-color-fg));
      }
    }
  }

  .rz-field-rich-text__label-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
