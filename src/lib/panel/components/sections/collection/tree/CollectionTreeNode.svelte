<script lang="ts">
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { GripVertical } from '@lucide/svelte';
  import StatusDot from '../StatusDot.svelte';
  import CollectionTreeNode from './CollectionTreeNode.svelte';
  import { countRows } from './util';

  type Props = { parentId: string; doc: GenericDoc; collection: CollectionContext };
  const { parentId, doc, collection }: Props = $props();
</script>

{#key `${parentId}-${doc.id}-${doc._position}`}
  <div data-parent={parentId} data-id={doc.id} class="rz-collection-node">
    <a href="/panel/{doc._type}/{doc.id}" class="rz-collection-node__row">
      <div class="rz-collection-node__grip"><GripVertical size="12" /></div>
      <div>
        {doc.title}
      </div>
      {#if collection.hasDraft}
        <StatusDot --rz-dot-size="0.3rem" status={doc.status} />
      {/if}
    </a>
    <div
      class="rz-collection-sortable"
      style="--data-rows-count:{countRows(doc._children)}"
      data-id={doc.id}
    >
      {#if doc._children && doc._children.length > 0}
        {#each doc._children as child (child.id)}
          <CollectionTreeNode {collection} doc={child} parentId={doc.id} />
        {/each}
      {/if}
    </div>
  </div>
{/key}

<style>
  .rz-collection-node__grip {
    cursor: grab;
  }
  .rz-collection-node__row {
    background-color: hsl(var(--rz-row-bg));
    display: flex;
    border: var(--rz-border);
    border-radius: var(--rz-radius-lg);
    height: var(--rz-row-height);
    align-items: center;
    gap: var(--rz-size-2);
    padding: 0 1rem;
    justify-self: self-start;
    width: 100%;
    position: relative;
  }
  .rz-collection-node:not([data-parent='root']) .rz-collection-node__row::before {
    content: '';
    border-top: var(--rz-border);
    translate: calc(-1 * var(--rz-size-6)) calc(var(--half-h) - 1px);
    position: absolute;
    top: 0;
    bottom: var(--half-h);
    left: 0;
    width: var(--rz-size-6);
  }
</style>
