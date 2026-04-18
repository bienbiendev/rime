<script lang="ts">
  import type { FormField } from '$lib/fields/types.js';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import { ChevronDown, ChevronUp } from '@lucide/svelte';

  type TableColumn = Partial<FormField> & { name: string; label?: string };

  const collection = getCollectionContext('list');
  let gridTemplateColumn = $state('grid-template-columns: 2fr repeat(1, minmax(0, 1fr));');

  $effect(() => {
    const columnLength = collection.columns.length + 2;
    gridTemplateColumn = `grid-template-columns: 2fr repeat(${columnLength - 1}, minmax(0, 1fr));`;
  });
</script>

{#snippet columnHeader(label: string)}
  <div class="rz-list-header__column">
    {capitalize(label)}
  </div>
{/snippet}

{#snippet sortableColumnHeader(column: TableColumn)}
  <div>
    <button
      onclick={() => collection.sortBy(column.name)}
      aria-label="sort {column.name}"
      type="button"
      class="rz-list-header__sort-button"
    >
      {capitalize(column.label || column.name)}

      {#if collection.sortingBy === column.name && collection.sortingOrder === 'dsc'}
        <ChevronUp size={12} />
      {:else}
        <ChevronDown size={12} />
      {/if}
    </button>
  </div>
{/snippet}

<div style={gridTemplateColumn} class="rz-list-header">
  {@render sortableColumnHeader({ name: collection.config.asTitle.split('.').at(-1) || 'title' })}

  {#each collection.columns as column, index (index)}
    {#if column.table.sort}
      {@render sortableColumnHeader(column)}
    {:else}
      {@render columnHeader(column.label || column.name)}
    {/if}
  {/each}

  {@render sortableColumnHeader({ name: 'updatedAt' })}
</div>

<style type="postcss">
  @import '../../../../../style/mixins/index.css';

  .rz-list-header {
    display: grid;
    height: var(--rz-size-14);
    /* width: calc(100% - var(--rz-size-10)); */
    align-items: center;
    border-bottom: var(--rz-border);
    /* margin-left: var(--rz-size-5); */
    font-size: var(--rz-text-sm);
  }

  .rz-list-header__column {
    @mixin color ground-2;
    display: flex;
    align-items: center;
    gap: var(--rz-size-1);
  }

  .rz-list-header__sort-button {
    @mixin color ground-2;
    display: flex;
    align-items: center;
    gap: var(--rz-size-1);
  }
</style>
