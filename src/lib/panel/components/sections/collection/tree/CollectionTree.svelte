<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import '$lib/panel/components/ui/tree/tree-rows.css';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte';
  import Sortable from 'sortablejs';
  import { onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import Empty from '../Empty.svelte';
  import CollectionTreeNode from './CollectionTreeNode.svelte';

  type Props = { collection: CollectionContext };
  const { collection }: Props = $props();

  // Track collection stamp for reactivity
  const collectionStamp = $derived(collection.stamp);

  let sortingInitialized = $state(false);
  let sortableInstances = $state<ReturnType<typeof Sortable.create>[]>([]);
  const shouldInit = $derived(!sortingInitialized && collection.docs.length > 0);

  const sortableOptions: Sortable.Options = {
    handle: '.rz-collection-node__grip',
    animation: 150,
    swapThreshold: 0.93,
    // A childless node's list has no height: a drop this close to it nests under that node.
    emptyInsertThreshold: 8,
    group: {
      name: `list-nested`
    },
    onEnd: function (evt) {
      const { newIndex, oldIndex } = evt;

      const fromParentId =
        //@ts-expect-error annoying
        evt.item.getAttribute('data-parent') || evt.item.__attributes?.['data-parent'];
      //@ts-expect-error annoying
      const toParentId = evt.to.getAttribute('data-id') || evt.to.__attributes?.['data-id'];
      //@ts-expect-error annoying
      const nodeId = evt.item.getAttribute('data-id') || evt.item.__attributes?.['data-id'];

      collection
        .handleNestedDocumentMove({
          documentId: nodeId,
          from: {
            parent: fromParentId === 'root' ? null : fromParentId,
            index: oldIndex || 0
          },
          to: {
            parent: toParentId === 'root' ? null : toParentId,
            index: newIndex || 0
          }
        })
        .then((success) => {
          if (success) {
            toast.success('Order updated');
            resetSortable();
          } else {
            toast.error('An error occured');
          }
        });
    }
  };

  const initSortable = () => {
    // Get all sortable containers including the root and nested ones
    const sortableContainers = document.querySelectorAll('.rz-collection-sortable');

    // Create Sortable instance for each container
    sortableContainers.forEach((container) => {
      const instance = Sortable.create(container as HTMLElement, sortableOptions);
      sortableInstances.push(instance);
    });
  };

  const resetSortable = () => {
    destroySortable();
    sortingInitialized = false;
  };

  const destroySortable = () => {
    sortableInstances.forEach((instance) => instance.destroy());
    sortableInstances = [];
  };

  $effect(() => {
    if (shouldInit) {
      initSortable();
      sortingInitialized = true;
    }
  });

  onDestroy(() => {
    destroySortable();
  });
</script>

{#key `${collectionStamp}`}
  {#if collection.docs.length}
    <!-- One raised card, like the list: the column labels, then the rows. -->
    <div class="rz-collection-tree rz-tree-card">
      <div class="rz-collection-tree__head">
        <span class="rz-collection-tree__head-title">{t__('common.title')}</span>
        {#if collection.hasDraft}
          <span data-column="status">{t__('common.status')}</span>
        {/if}
        <span data-column="author">{t__('common.author')}</span>
        <span data-column="date">{t__('common.updated')}</span>
      </div>

      <div
        class="rz-collection-sortable rz-tree-rows rz-tree-rows--root"
        data-id="root"
        style:--rz-tree-depth="0"
      >
        {#each collection.nested as doc, index (index)}
          <CollectionTreeNode {collection} parentId="root" {doc} />
        {/each}
      </div>
    </div>
  {:else}
    <Empty config={collection.config} />
  {/if}
{/key}

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-collection-tree {
    border-radius: var(--rz-radius-lg);
  }

  /* The column labels: the list's, without sorting, the order being the tree's. */
  .rz-collection-tree__head {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    height: --size(8.5);
    padding-left: var(--rz-size-6);
    padding-right: var(--rz-size-2);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    @mixin font-medium;
  }

  .rz-collection-tree__head-title {
    flex: 1;
  }

  /* The right columns share their widths with the rows. */
  .rz-collection-tree :global([data-column]) {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
  .rz-collection-tree :global([data-column='status']) {
    width: var(--rz-size-28);
  }
  .rz-collection-tree :global([data-column='author']) {
    width: var(--rz-size-32);
  }
  .rz-collection-tree :global([data-column='date']) {
    justify-content: flex-end;
    width: var(--rz-size-24);
  }

  /* Narrower: without the author, then without the status. */
  @container collection-area (max-width: 44rem) {
    .rz-collection-tree :global([data-column='author']) {
      display: none;
    }
  }

  @container collection-area (max-width: 32rem) {
    .rz-collection-tree :global([data-column='status']) {
      display: none;
    }
  }
</style>
