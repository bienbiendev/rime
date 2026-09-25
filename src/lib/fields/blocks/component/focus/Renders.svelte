<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { shiftListPath } from '$lib/panel/context/blocks-ops.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { GripVertical } from '@lucide/svelte';
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
   * The stage is in the same group as the layers: a block drags from one to the other, and a
   * type drags in from the palette. Only the grip starts a drag, so a field inside a render
   * keeps the mouse.
   */
  const { sortable } = useSortable({
    group: {
      name: 'rz-blocks-layers',
      pull: true,
      put: (to, _from, dragged) =>
        form.blocks.accepts(to.el.dataset.list ?? '', (dragged as HTMLElement).dataset.type ?? '')
    },
    handle: '.rz-renders__grip',
    draggable: '.rz-renders__item',
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    disabled: focus.locked,
    /** A type dropped from the palette: a new block at the drop index. */
    onAdd: (event: Sortable.SortableEvent) => {
      if (!event.from.classList.contains('rz-palette__list')) return;
      const type = event.item.dataset.type;
      if (type === undefined || event.newIndex === undefined) return;
      focus.insertType(type, { list, index: event.newIndex });
    },
    onEnd: (event: Sortable.SortableEvent) => {
      const fromList = event.from.dataset.list;
      const toList = event.to.dataset.list;
      const { oldIndex, newIndex } = event;
      if (fromList === undefined || toList === undefined) return;
      if (oldIndex === undefined || newIndex === undefined) return;
      form.blocks.move(`${fromList}.${oldIndex}`, { list: toList, index: newIndex });
      const landed =
        fromList === toList ? toList : shiftListPath(toList, { list: fromList, index: oldIndex });
      focus.select(`${landed}.${newIndex}`);
    }
  });

  function sortableList(node: HTMLElement) {
    const instance = sortable(node);
    return { destroy: () => instance.destroy() };
  }
</script>

<!--
  One list of blocks, one wrapper per block. A block's nested lists are the `nested` snippet its
  render puts where they go; a block without a render is a placeholder card with them below.
-->
<div class="rz-renders" data-list={list} data-empty={rows.length ? undefined : ''} use:sortableList>
  {#each rows as row (row.block.id)}
    {@const config = row.config}
    {@const Render = config?.render}
    {#snippet nested(name?: string)}
      {#each row.children.filter((child) => !name || child.builder.name === name) as child (child.list)}
        <Renders {form} list={child.list} />
      {/each}
    {/snippet}
    <div
      class="rz-renders__item"
      data-placeholder={config?.render ? null : ''}
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
      {#if !focus.locked}
        <span class="rz-renders__grip" aria-hidden="true"><GripVertical size={14} /></span>
      {/if}
      {#if config?.render}
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
    border-radius: var(--rz-radius-md);
  }

  .rz-renders__item {
    position: relative;
    outline: 1px solid transparent;
    outline-offset: 3px;
    cursor: pointer;

    &:hover {
      outline-color: hsl(var(--rz-color-spot) / 0.15);
    }
    &:focus-visible {
      outline-color: hsl(var(--rz-color-spot) / 0.3);
    }
    &[data-placeholder] {
      border-radius: var(--rz-radius-md);
    }
  }

  .rz-renders__item[data-selected],
  .rz-renders__item[data-selected]:hover {
    outline: 2px solid hsl(var(--rz-color-spot) / 0.3);
  }

  /** The one thing that drags: the block's own fields keep the mouse. */
  .rz-renders__grip {
    position: absolute;
    top: 0;
    left: calc(-1 * var(--rz-size-6));
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--rz-size-5);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-sm);
    opacity: 0;
    cursor: grab;
    color: hsl(var(--rz-color-fg) / 0.5);
  }

  .rz-renders__item:hover > .rz-renders__grip,
  .rz-renders__item[data-selected] > .rz-renders__grip {
    opacity: 1;
  }

  :global(.rz-renders__item.sortable-ghost) {
    opacity: 0.4;
  }

  .rz-renders__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
