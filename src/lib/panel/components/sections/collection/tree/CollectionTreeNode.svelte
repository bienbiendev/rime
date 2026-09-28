<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { panelUrl } from '$lib/core/routes/util.js';
  import type { CollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { ChevronDown, ChevronRight, GripVertical } from '@lucide/svelte';
  import Avatar from '../Avatar.svelte';
  import DocStatus from '../DocStatus.svelte';
  import When from '../When.svelte';
  import CollectionTreeNode from './CollectionTreeNode.svelte';

  type Props = {
    parentId: string;
    doc: GenericDoc;
    collection: CollectionContext;
    /** How deep the node sits: 0 at the root. */
    depth?: number;
  };
  const { parentId, doc, collection, depth = 0 }: Props = $props();

  const children = $derived<GenericDoc[]>(doc._children ?? []);
  const author = $derived<string>(doc.updatedBy?.name ?? '');
  // "Anthony Ivol" -> "Anthony"
  const firstName = $derived(author.split(/\s+/)[0]);

  /** The browser keeps the folded ones: `rz-tree-folded:<id>` is set while one is folded. */
  const FOLDED_KEY = 'rz-tree-folded:';
  let folded = $state(false);

  $effect(() => {
    folded = localStorage.getItem(FOLDED_KEY + doc.id) === '1';
  });

  function toggleFolded() {
    folded = !folded;
    if (folded) localStorage.setItem(FOLDED_KEY + doc.id, '1');
    else localStorage.removeItem(FOLDED_KEY + doc.id);
  }
</script>

{#key `${parentId}-${doc.id}-${doc._position}`}
  <!-- A row, then the list of its children: the depth is the list's, so a dragged row takes the depth of the list it is over. -->
  <div data-parent={parentId} data-id={doc.id} class="rz-collection-node">
    <div class="rz-tree-row rz-collection-node__row">
      <span class="rz-tree-row__grip rz-collection-node__grip" aria-hidden="true">
        <GripVertical size={12} />
      </span>

      <!-- Only a page with children has one: the others start their title there. -->
      {#if children.length}
        <button
          type="button"
          class="rz-tree-row__fold rz-collection-node__fold"
          aria-expanded={!folded}
          aria-label={folded ? t__('fields.unfold') : t__('fields.fold')}
          onclick={toggleFolded}
        >
          {#if folded}<ChevronRight size={14} />{:else}<ChevronDown size={14} />{/if}
        </button>
      {/if}

      <!-- The title covers the whole row: a click anywhere but the grip and the chevron opens it. -->
      <a href={panelUrl(doc._type, doc.id)} class="rz-tree-row__title rz-collection-node__title">
        {doc.title || '[untitled]'}
      </a>

      {#if folded && children.length}
        <span class="rz-tree-row__count">{children.length}</span>
      {/if}

      <span class="rz-collection-node__cells">
        {#if collection.hasDraft}
          <span class="rz-collection-node__cell" data-column="status">
            {#if doc.status}<DocStatus status={doc.status} />{/if}
          </span>
        {/if}
        <span class="rz-collection-node__cell" data-column="author" title={author}>
          {#if author}
            <Avatar size="xs" name={author} />
            <span class="rz-collection-node__author">{firstName}</span>
          {/if}
        </span>
        <span class="rz-collection-node__cell" data-column="date">
          {#if doc.updatedAt}<When date={doc.updatedAt} />{/if}
        </span>
      </span>
    </div>

    <div
      class="rz-collection-sortable rz-tree-rows"
      data-id={doc.id}
      style:--rz-tree-depth={depth + 1}
      hidden={folded}
    >
      {#each children as child (child.id)}
        <CollectionTreeNode {collection} doc={child} parentId={doc.id} depth={depth + 1} />
      {/each}
    </div>
  </div>
{/key}

<style lang="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-collection-node__row {
    gap: var(--rz-size-2);
  }

  /* Above the title's cover, so they keep their own clicks. */
  .rz-collection-node__grip,
  .rz-collection-node__fold {
    z-index: 1;
  }

  .rz-collection-node__fold {
    position: relative;
  }

  .rz-collection-node__title {
    font-size: var(--rz-text-md);
    color: var(--rz-fg);

    &::after {
      content: '';
      position: absolute;
      inset: 0;
    }

    &:focus-visible {
      outline: none;
    }
    &:focus-visible::after {
      @mixin focus-ring;
      outline-offset: -2px;
    }
  }

  /* The columns on the right, the widths of the list's. */
  .rz-collection-node__cells {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-3);
    margin-left: auto;
    padding-left: var(--rz-size-3);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-md);
  }
</style>
