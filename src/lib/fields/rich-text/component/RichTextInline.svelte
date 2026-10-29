<script lang="ts">
  import type { JSONContent } from '@tiptap/core';
  import { defaultFeatures } from '../core/features/index.js';
  import RichTextEditorCore from '../core/rich-text-editor-core.svelte';
  import type { RichTextFieldProps } from './props.js';

  const { path, config, form, class: className }: RichTextFieldProps = $props();

  const field = $derived(form.useField<JSONContent>(path, config));
</script>

<!-- A rich text edited where a block render draws it: the editor's controls, no fieldset. -->
<RichTextEditorCore
  {path}
  features={config.get.features || defaultFeatures}
  value={field.value}
  editable={field.editable}
  error={!!field.error}
  class={className}
  onUpdate={(json) => (field.value = json)}
/>
