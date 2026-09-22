<script lang="ts">
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import type { JSONContent } from '@tiptap/core';
  import { defaultFeatures } from '../core/features/index.js';
  import RichTextEditorCore from '../core/rich-text-editor-core.svelte';
  import type { RichTextFieldProps } from './props.js';
  import './styles/field.css';

  const { path, config, form, standAlone, class: className }: RichTextFieldProps = $props();

  const field = $derived(form.useField<JSONContent>(path, config));
</script>

<fieldset
  class:rz-field-rich-text--standalone={standAlone}
  class="rz-field-rich-text {config.get.className || ''}"
  use:fieldset={field}
>
  <Field.Label {config} for={path || config.name} />

  <Field.Error error={field.error} />

  <RichTextEditorCore
    {path}
    features={config.get.features || defaultFeatures}
    value={field.value}
    editable={field.editable}
    error={!!field.error}
    class={className}
    onUpdate={(json) => (field.value = json)}
  />

  {#if !standAlone}
    <Field.Hint {config} />
  {/if}
</fieldset>

<style type="postcss">
  .rz-field-rich-text__label-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
