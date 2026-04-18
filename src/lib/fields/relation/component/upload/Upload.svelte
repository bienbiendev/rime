<script lang="ts">
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import Doc from '$lib/panel/components/sections/document/Document.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import CardResource from '$lib/panel/components/ui/card-resource/card-resource.svelte';
  import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { createBlankDocument } from '$lib/util/doc.js';
  import { Plus } from '@lucide/svelte';
  import Sortable from 'sortablejs';
  import { onDestroy } from 'svelte';
  import type { RelationComponentProps, RelationFieldItem } from '../types.js';
  import Browse from './Browse.svelte';
  import './upload.css';

  const {
    isFull,
    hasError,
    addValue,
    many,
    selectedItems,
    removeValue,
    availableItems,
    relationConfig,
    onOrderChange,
    formNestedLevel,
    onRelationCreation,
    onRelationCreationCanceled,
    onRelationCreated,
    stamp
  }: Omit<RelationComponentProps, 'readOnly'> = $props();

  const user = getUserContext();

  let open = $state(false);
  let create = $state(false);
  let instance: ReturnType<typeof Sortable.create>;

  const sortableOptions: Sortable.Options = {
    animation: 150,

    // group: new Date().getTime().toString(),
    onEnd: function (evt) {
      const { oldIndex, newIndex } = evt;
      if (oldIndex !== undefined && newIndex !== undefined) {
        onOrderChange(oldIndex, newIndex);
      }
    }
  };

  const onNestedDocumentCreated = (doc: GenericDoc) => {
    create = false;
    onRelationCreated(doc);
  };

  $effect(() => {
    if (many) {
      const list = document.querySelector(
        `.rz-relation-upload__list[data-list="${stamp}"]`
      ) as HTMLDivElement;
      instance = Sortable.create(list, sortableOptions);
    }
  });

  $effect(() => {
    if (isFull) {
      open = false;
    }
  });

  onDestroy(() => {
    if (instance) instance.destroy();
  });
</script>

{#snippet card(item: RelationFieldItem)}
  {@const resource = { ...item, id: item.documentId }}
  <CardResource {resource} onCloseClick={() => removeValue(item.documentId)} />
{/snippet}

{#key stamp}
  <div
    class="rz-relation-upload__list"
    data-many={many ? '' : null}
    data-list={stamp}
    data-error={hasError ? '' : null}
  >
    {#each selectedItems as item (item.documentId)}
      {@render card(item)}
    {/each}
  </div>
{/key}

<div
  class="rz-relation-upload__actions"
  class:rz-relation-upload__actions--list-empty={selectedItems.length === 0}
>
  <Button
    disabled={isFull || availableItems.length === 0}
    onclick={() => (open = true)}
    variant="outline"
  >
    Select a {relationConfig.label.singular || relationConfig.slug}
  </Button>

  <Button
    disabled={isFull ||
      !(relationConfig.access.create && relationConfig.access.create(user.attributes, {}))}
    onclick={() => {
      create = true;
      onRelationCreation();
    }}
    variant="outline"
  >
    <Plus size="14" />
  </Button>
</div>

<Browse bind:open {addValue} config={relationConfig} />

<Sheet.Root
  bind:open={create}
  onOpenChange={(bool) => {
    create = bool;
    if (bool === false) {
      onRelationCreationCanceled();
    }
  }}
>
  <Sheet.Content style="--rz-page-gutter:var(--rz-size-6)" showCloseButton={false} side="right">
    <Doc
      doc={createBlankDocument(relationConfig)}
      readOnly={false}
      onClose={() => (create = false)}
      operation="create"
      {onNestedDocumentCreated}
      nestedLevel={formNestedLevel + 1}
    />
  </Sheet.Content>
</Sheet.Root>
