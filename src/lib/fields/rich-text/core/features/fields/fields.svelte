<script lang="ts">
  import { FieldBuilder, FormFieldBuilder } from '#lib/core/fields/builders/index.js';
  import type { FieldsPreviewProps } from '#lib/fields/types.js';
  import type { Dic } from '#lib/util/types.js';
  import type { NodeViewProps } from '@tiptap/core';
  import { onMount, type Component } from 'svelte';
  import NodeViewWrapper from '../../svelte/node-view-wrapper.svelte';
  import FieldsForm from './fields-form.svelte';
  import './fields.css';

  type Props = Omit<NodeViewProps, 'extension'> & {
    extension: {
      options: {
        fields: FieldBuilder[];
        preview?: Component<FieldsPreviewProps>;
      };
    };
  };

  let { node, editor, extension, updateAttributes }: Props = $props();
  let isSheetOpen = $state(false);

  // The values this view wrote last. A node holding other values changed from outside (undo,
  // another editor on the same path), and the form is built again from them.
  // svelte-ignore state_referenced_locally
  let written: unknown = node.attrs.json;
  let generation = $state(0);
  $effect(() => {
    if (node.attrs.json !== written) {
      written = node.attrs.json;
      generation += 1;
    }
  });

  function write(values: Dic) {
    written = values;
    updateAttributes({ json: values });
  }

  // A new node opens its sheet, and holds an empty set of values so it opens it only once
  onMount(() => {
    if (node.attrs.json) {
      return;
    }
    isSheetOpen = true;
    if (editor.isEditable) {
      write({});
    }
  });

  const previewFields = $derived.by(() => {
    return extension.options.fields.filter((field) => field instanceof FormFieldBuilder);
  });
</script>

<NodeViewWrapper>
  {#key generation}
    <FieldsForm
      values={node.attrs.json || {}}
      fields={previewFields}
      preview={extension.options.preview}
      bind:isSheetOpen
      onchange={write}
    />
  {/key}
</NodeViewWrapper>
