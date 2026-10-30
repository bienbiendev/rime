<script lang="ts">
  import type { FormFieldBuilder } from '#lib/core/fields/builders/index.js';
  import type { FieldsPreviewProps, FormField } from '#lib/fields/types.js';
  import FieldsPreview from '#lib/panel/components/fields/FieldsPreview.svelte';
  import FieldsPreviewTrigger from '#lib/panel/components/fields/FieldsPreviewTrigger.svelte';
  import * as Sheet from '#lib/panel/components/ui/sheet/index.js';
  import { createFormStore } from '#lib/panel/context/form.svelte.js';
  import type { Dic } from '#lib/util/types.js';
  import type { Component } from 'svelte';

  type Props = {
    values: Dic;
    fields: FormFieldBuilder<FormField>[];
    preview?: Component<FieldsPreviewProps>;
    isSheetOpen: boolean;
    onchange: (values: Dic) => void;
  };

  let { values, fields, preview, isSheetOpen = $bindable(), onchange }: Props = $props();

  // svelte-ignore state_referenced_locally
  const form = createFormStore(values);

  // Each valid change in the form goes to `onchange`; the values it starts from are not sent
  // back, and a field with an error keeps the node's last valid values
  let started = false;
  $effect(() => {
    const current = form.values;
    if (started && !form.errors.length) {
      onchange(current);
    }
    started = true;
  });

  const classModifiers = $derived(preview ? 'rz-rich-text-fields-preview--custom' : '');
</script>

<!-- The preview and the sheet of a fields node, over a form built from the node's values. -->

<FieldsPreviewTrigger
  class="rz-rich-text-fields-preview {classModifiers}"
  onclick={() => (isSheetOpen = true)}
>
  <FieldsPreview {fields} getField={(field) => form.useField(field.name, field)} {preview} />
</FieldsPreviewTrigger>

<Sheet.Root bind:open={isSheetOpen}>
  <Sheet.Content preventScroll={false} side="right" class="rz-rich-text-sheet">
    {#each fields as field, index (index)}
      {@const FieldComponent = field.component}
      <FieldComponent path={field.name} config={field} {form} />
    {/each}
  </Sheet.Content>
</Sheet.Root>
