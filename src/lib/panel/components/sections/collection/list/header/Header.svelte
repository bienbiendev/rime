<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { ChevronDown, ChevronUp } from '@lucide/svelte';

  const collection = getCollectionContext();

  // attributes.title -> title
  const titleName = $derived(collection.config.asTitle.split('.').at(-1) || 'title');
</script>

{#snippet sortable(name: string, label: string)}
  {@const active = collection.sortingBy === name}
  <button
    onclick={() => collection.sortBy(name)}
    aria-label={t__('common.sort_by', label)}
    type="button"
    class="rz-list-header__sort-button"
    class:rz-list-header__sort-button--active={active}
  >
    {label}
    {#if active && collection.sortingOrder === 'asc'}
      <ChevronUp size={12} />
    {:else}
      <ChevronDown size={12} />
    {/if}
  </button>
{/snippet}

<!-- The column labels, on the tracks the list gives its rows. -->
<div class="rz-list-header">
  <span></span>

  <div class="rz-list-header__column">
    {@render sortable(titleName, t__('common.title'))}
  </div>

  {#each collection.columns as column (column.path)}
    <div class="rz-list-header__column" data-column="field">
      {#if column.table.sort}
        {@render sortable(column.name, column.label ?? column.name)}
      {:else}
        {column.label ?? column.name}
      {/if}
    </div>
  {/each}

  {#if collection.hasDraft}
    <div class="rz-list-header__column" data-column="status">
      {@render sortable('status', t__('common.status'))}
    </div>
  {/if}

  <!-- The author is not sortable. -->
  <div class="rz-list-header__column" data-column="author">{t__('common.author')}</div>

  <div class="rz-list-header__column rz-list-header__column--date">
    {@render sortable('updatedAt', t__('common.updated'))}
  </div>
</div>

<style type="postcss">
  @import '../../../../../style/mixins/index.css';

  .rz-list-header {
    display: grid;
    align-items: center;
    gap: var(--rz-size-3);
    height: --size(8.5);
    padding-inline: var(--rz-size-3) var(--rz-size-3-5);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    @mixin font-medium;
  }

  .rz-list-header__column {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* The date sits on the right, like the dates below it. */
  .rz-list-header__column--date {
    justify-content: flex-end;
  }

  .rz-list-header__sort-button {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1);
    border-radius: var(--rz-radius-sm);
    color: inherit;
    transition: color 0.15s;

    :global(svg) {
      opacity: 0;
      transition: opacity 0.15s;
    }

    &:hover {
      color: var(--rz-fg);
    }

    &:hover :global(svg),
    &.rz-list-header__sort-button--active :global(svg) {
      opacity: 1;
    }

    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-list-header__sort-button--active {
    color: var(--rz-fg-muted);
  }
</style>
