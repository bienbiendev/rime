<script lang="ts">
  import type { BuiltCollection } from '$lib/core/config/types.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import Doc from '$lib/panel/components/sections/document/Document.svelte';
  import * as Sheet from '$lib/panel/components/ui/sheet/index.js';

  type Props = {
    open: boolean;
    config: BuiltCollection;
    /** The level of the new document's form: one above the document it is created for. */
    nestedLevel: number;
    onCreated: (doc: GenericDoc) => void;
    onCancel: () => void;
  };
  let { open = $bindable(), config, nestedLevel, onCreated, onCancel }: Props = $props();
</script>

<!-- A new document of the related collection, in a sheet from the right. -->
<Sheet.Root
  bind:open
  onOpenChange={(value) => {
    if (!value) onCancel();
  }}
>
  <Sheet.Content style="--rz-page-gutter:var(--rz-size-6)" showCloseButton={false} side="right">
    <Doc
      doc={config.blank()}
      readOnly={false}
      onClose={() => {
        open = false;
        onCancel();
      }}
      operation="create"
      onNestedDocumentCreated={(doc: GenericDoc) => {
        open = false;
        onCreated(doc);
      }}
      {nestedLevel}
    />
  </Sheet.Content>
</Sheet.Root>
