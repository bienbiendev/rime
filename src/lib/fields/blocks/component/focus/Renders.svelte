<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import type Sortable from 'sortablejs';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import RenderPlaceholder from './RenderPlaceholder.svelte';
  import Renders from './Renders.svelte';

  type Props = { form: DocumentFormContext; list: string };
  const { form, list }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const rows = $derived(focus.rowsOf(list));

  /** A click selects the row and stops there; a link inside a render does not navigate. */
  function select(event: MouseEvent, rowPath: string) {
    event.stopPropagation();
    if ((event.target as Element).closest('a[href]')) event.preventDefault();
    focus.select(rowPath, { extend: event.shiftKey });
  }

  /**
   * A drop target for the palette, never a source: a type dragged from it lands at the drop
   * index. The blocks themselves do not drag, so a field inside a render keeps the mouse.
   */
  const { sortable } = useSortable({
    group: {
      name: 'rz-blocks-layers',
      pull: false,
      put: (_to, from, dragged) =>
        from.el.classList.contains('rz-palette__list') &&
        form.blocks.accepts(list, (dragged as HTMLElement).dataset.type ?? '')
    },
    sort: false,
    draggable: '.rz-renders__item',
    filter: '.rz-renders__item',
    preventOnFilter: false,
    animation: 150,
    disabled: focus.locked,
    onAdd: (event: Sortable.SortableEvent) => {
      const type = event.item.dataset.type;
      if (type === undefined || event.newIndex === undefined) return;
      focus.insertType(type, { list, index: event.newIndex });
    }
  });

  function dropTarget(node: HTMLElement) {
    const instance = sortable(node);
    return { destroy: () => instance.destroy() };
  }
</script>

<!--
  One list of blocks, one wrapper per block. A block's nested lists are the `nested` snippet its
  render puts where they go; a block without a render is a placeholder card with them below.
-->
<div class="rz-renders" data-list={list} data-empty={rows.length ? undefined : ''} use:dropTarget>
  {#each rows as row (row.block.id)}
    {@const config = row.config}
    {#snippet nested(name?: string)}
      {#each row.children.filter((child) => !name || child.builder.name === name) as child (child.list)}
        <Renders {form} list={child.list} />
      {/each}
    {/snippet}
    <div
      class="rz-renders__item"
      data-path={row.path}
      data-type={row.block.type}
      data-selected={focus.isSelected(row.path) ? '' : undefined}
      role="button"
      tabindex="0"
      onclick={(event) => select(event, row.path)}
      onkeydown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault();
          focus.select(row.path);
        }
      }}
    >
      {#if config?.render}
        {@const Render = config.render}
        <svelte:boundary>
          <Render
            block={row.block}
            path={row.path}
            fields={config.fields}
            {form}
            children={nested}
          />
          {#snippet failed(error)}
            <RenderPlaceholder {row} {error} children={nested} />
          {/snippet}
        </svelte:boundary>
      {:else}
        <RenderPlaceholder {row} children={nested} />
      {/if}
    </div>
  {:else}
    {#if list === focus.path}
      <p class="rz-renders__empty">{t__('fields.no_blocks_yet_render')}</p>
    {/if}
  {/each}
</div>

<style lang="postcss">
  .rz-renders {
    display: grid;
    gap: var(--rz-size-3);
    min-height: var(--rz-size-8);
  }

  /* An empty nested list: somewhere to drop a type. */
  .rz-renders[data-empty]:not([data-list='']) {
    border: 1px dashed hsl(var(--rz-color-fg) / 0.15);
    border-radius: var(--rz-radius-sm);
  }

  .rz-renders__item {
    border-radius: var(--rz-radius-md);
    outline: 1px solid transparent;
    outline-offset: 3px;
    cursor: pointer;

    &:hover {
      outline-color: hsl(var(--rz-color-fg) / 0.15);
    }
    &:focus-visible {
      outline-color: hsl(var(--rz-color-fg) / 0.3);
    }
  }

  .rz-renders__item[data-selected],
  .rz-renders__item[data-selected]:hover {
    outline: 2px solid hsl(var(--rz-color-fg) / 0.6);
  }

  .rz-renders__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
