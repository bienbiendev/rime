<script lang="ts">
  import { Field } from '$lib/panel/components/fields/index.js';
  import { root } from '$lib/panel/components/fields/root.svelte.js';
  import type { JSONContent } from '@tiptap/core';
  import { defaultFeatures } from '../core/features/index.js';
  import RichTextEditorCore from '../core/rich-text-editor-core.svelte';
  import type { RichTextFieldProps } from './props.js';
  import './styles/rich-text.css';

  const { path, config, form, standAlone, class: className }: RichTextFieldProps = $props();

  const field = $derived(form.useField<JSONContent>(path, config));
</script>

<fieldset
  class:rz-field-rich-text--standalone={standAlone}
  class="rz-field-rich-text {config.className || ''}"
  use:root={field}
>
  <Field.Label {config} for={path || config.name} />

  <Field.Error error={field.error} />

  <div class="rz-rich-text__editor-wrapper">
    <RichTextEditorCore
      {path}
      features={config.features || defaultFeatures}
      value={field.value}
      editable={field.editable}
      class="rz-rich-text__editor {className}"
      data-error={field.error ? 'true' : null}
      syncExternalValue
      onUpdate={(json) => (field.value = json)}
    />
  </div>

  {#if !standAlone}
    <Field.Hint {config} />
  {/if}
</fieldset>

<style type="postcss">
  .rz-rich-text__editor-wrapper {
    position: relative;
  }

  .rz-field-rich-text__label-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
