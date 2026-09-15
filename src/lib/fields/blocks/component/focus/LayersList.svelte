<script lang="ts">
  import { shiftListPath } from '$lib/panel/context/blocks-ops.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { ChevronDown, ChevronRight, ToyBrick } from '@lucide/svelte';
  import type Sortable from 'sortablejs';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import LayersList from './LayersList.svelte';

  type Props = { form: DocumentFormContext; list: string; depth: number };
  const { form, list, depth }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const rows = $derived(focus.rowsOf(list, depth));

  const hasError = (rowPath: string) =>
    Object.keys(form.errors.value).some((key) => key === rowPath || key.startsWith(`${rowPath}.`));

  /**
   * Every list of the layers is in one sortable group, so a row drags from any list to any list
   * whose block set has its type. The DOM is put back before the form moves the block; the
   * re-render is what shows the move.
   */
  const { sortable } = useSortable({
    group: {
      name: 'rz-blocks-layers',
      pull: true,
      put: (to, _from, dragged) =>
        form.blocks.accepts(to.el.dataset.list ?? '', (dragged as HTMLElement).dataset.type ?? '')
    },
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    disabled: focus.locked,
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

<ul class="rz-layers__list" data-list={list} data-empty={rows.length ? null : ''} use:sortableList>
  {#each rows as row (row.block.id)}
    {@const Icon = row.config?.icon ?? ToyBrick}
    {@const folded = focus.isCollapsed(row.path)}
    <li class="rz-layers__item" data-type={row.block.type} data-path={row.path}>
      <div
        class="rz-layers__row"
        class:rz-layers__row--selected={focus.isSelected(row.path)}
        style:--rz-layers-depth={depth}
        role="button"
        tabindex="0"
        onclick={(event) => focus.select(row.path, { extend: event.shiftKey })}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focus.select(row.path);
          }
        }}
      >
        {#if row.children.length}
          <button
            type="button"
            class="rz-layers__toggle"
            aria-label={folded ? 'expand' : 'collapse'}
            onclick={(event) => {
              event.stopPropagation();
              focus.toggleCollapsed(row.path);
            }}
          >
            {#if folded}<ChevronRight size={12} />{:else}<ChevronDown size={12} />{/if}
          </button>
        {:else}
          <span class="rz-layers__toggle"></span>
        {/if}
        <span class="rz-layers__icon"><Icon size={12} /></span>
        <span class="rz-layers__title">{row.title}</span>
        {#if hasError(row.path)}
          <span class="rz-layers__error" aria-label="error"></span>
        {/if}
      </div>

      {#if row.children.length && !folded}
        {#each row.children as child (child.list)}
          <div class="rz-layers__child">
            {#if row.children.length > 1}
              <span class="rz-layers__child-label" style:--rz-layers-depth={depth + 1}>
                {child.label}
              </span>
            {/if}
            <LayersList {form} list={child.list} depth={depth + 1} />
          </div>
        {/each}
      {/if}
    </li>
  {/each}
</ul>

<style lang="postcss">
  .rz-layers__list {
    display: grid;
    gap: 1px;
    min-height: var(--rz-size-2);
  }

  .rz-layers__list[data-empty] {
    min-height: var(--rz-size-7);
    margin-left: calc(var(--rz-size-5) * (var(--rz-layers-depth, 0) + 1));
    border: 1px dashed hsl(var(--rz-color-fg) / 0.15);
    border-radius: var(--rz-radius-sm);
  }

  .rz-layers__row {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    height: var(--rz-size-8);
    padding-right: var(--rz-size-2);
    padding-left: calc(var(--rz-size-0-5) + var(--rz-size-1-5) * var(--rz-layers-depth, 0));
    border-radius: var(--rz-radius-sm);
    font-size: var(--rz-text-xs);
    cursor: grab;
    user-select: none;

    &:hover {
      background-color: hsl(var(--rz-color-fg) / 0.04);
    }
    &:focus-visible {
      outline: 2px solid hsl(var(--rz-color-fg) / 0.2);
    }
  }

  .rz-layers__row--selected,
  .rz-layers__row--selected:hover {
    background-color: hsl(var(--rz-color-fg) / 0.08);
  }

  .rz-layers__toggle {
    display: flex;
    width: var(--rz-size-4);
    height: var(--rz-size-4);
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
  }

  .rz-layers__icon {
    display: flex;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .rz-layers__title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-layers__error {
    width: var(--rz-size-2);
    height: var(--rz-size-2);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-color-alert);
  }

  .rz-layers__child-label {
    display: block;
    padding-left: calc(var(--rz-size-0-5) + var(--rz-size-1-5) * var(--rz-layers-depth, 0));
    padding-block: var(--rz-size-1);
    font-size: var(--rz-text-2xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--rz-color-fg) / 0.5);
  }

  :global(.rz-layers__item.sortable-ghost > .rz-layers__row) {
    opacity: 0.4;
  }
</style>
