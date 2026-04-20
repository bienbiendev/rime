<script lang="ts">
  import { FieldBuilder, FormFieldBuilder } from '$lib/core/fields/builders';
  import type { FieldsPreviewProps } from '$lib/fields/types';
  import FieldsPreview from '$lib/panel/components/fields/FieldsPreview.svelte';
  import FieldsPreviewTrigger from '$lib/panel/components/fields/FieldsPreviewTrigger.svelte';
  import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
  import { setFormContext } from '$lib/panel/context/form.svelte';
  import type { NodeViewProps } from '@tiptap/core';
  import { onMount, type Component } from 'svelte';
  import NodeViewWrapper from '../../svelte/node-view-wrapper.svelte';
  import './fields.css';

  type Props = Omit<NodeViewProps, 'extension'> & {
    extension: {
      options: {
        fields: FieldBuilder[];
        preview?: Component<FieldsPreviewProps>;
      };
    };
  };

  let { node, extension, updateAttributes }: Props = $props();
  let isSheetOpen = $state(false);

  // svelte-ignore state_referenced_locally
  const form = setFormContext(node.attrs.json || {}, 'fields');

  onMount(() => {
    if (!node.attrs.json) {
      isSheetOpen = true;
    }
  });

  $effect(() => {
    if (form.values) {
      updateAttributes({
        json: form.values
      });
    }
  });

  const previewFields = $derived.by(() => {
    return extension.options.fields.filter((field) => field instanceof FormFieldBuilder);
  });

  const classModifiers = $derived(
    extension.options.preview ? 'rz-rich-text-fields-preview--custom' : ''
  );
</script>

<NodeViewWrapper>
  <FieldsPreviewTrigger
    class="rz-rich-text-fields-preview {classModifiers}"
    onclick={() => (isSheetOpen = true)}
  >
    <FieldsPreview
      fields={previewFields}
      getField={(field) => form.useField(field.name, field.raw)}
      preview={extension.options.preview}
    />
  </FieldsPreviewTrigger>
</NodeViewWrapper>

<Sheet.Root bind:open={isSheetOpen}>
  <Sheet.Content preventScroll={false} side="right" class="rz-rich-text-sheet">
    {#each previewFields || [] as field, index (index)}
      {@const FieldComponent = field.component}
      <FieldComponent path={field.raw.name} config={field.raw} {form} />
    {/each}
  </Sheet.Content>
</Sheet.Root>
