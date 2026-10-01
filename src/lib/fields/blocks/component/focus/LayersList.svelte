<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { shiftListPath } from '$lib/panel/context/blocks-ops.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { ChevronDown, ChevronRight, GripVertical, Pencil, ToyBrick } from '@lucide/svelte';
  import type Sortable from 'sortablejs';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import LayersList from './LayersList.svelte';

  /** `label` names the list above it, for a block that holds several. */
  type Props = { form: DocumentFormContext; list: string; depth: number; label?: string };
  const { form, list, depth, label }: Props = $props();

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
    },
    /** A type dropped from the palette: a new block at the drop index. */
    onAdd: (event: Sortable.SortableEvent) => {
      if (!event.from.classList.contains('rz-palette__list')) return;
      const type = event.item.dataset.type;
      if (type === undefined || event.newIndex === undefined) return;
      focus.insertType(type, { list, index: event.newIndex });
    }
  });

  function sortableList(node: HTMLElement) {
    const instance = sortable(node);
    return { destroy: () => instance.destroy() };
  }
</script>

{#if label}
  <span class="rz-layers__child-label" style:--rz-layers-depth={depth}>{label}</span>
{/if}
<ul
  class="rz-layers__list"
  data-list={list}
  data-empty={rows.length ? null : ''}
  style:--rz-layers-depth={depth}
  use:sortableList
>
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
        <span class="rz-layers__grip" aria-hidden="true"><GripVertical size={12} /></span>
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
        {/if}
        <span class="rz-layers__icon"><Icon size={13} /></span>
        <span class="rz-layers__title">{row.title}</span>
        {#if hasError(row.path)}
          <span class="rz-layers__error" aria-label="error"></span>
        {/if}
        {#if !focus.locked && focus.isSelected(row.path)}
          <!-- The fields are a tab away: this opens it. -->
          <button
            type="button"
            class="rz-layers__edit"
            title={t__('fields.edit')}
            aria-label={t__('fields.edit')}
            onclick={(event) => {
              event.stopPropagation();
              focus.inspect();
            }}
          >
            <Pencil size={12} />
          </button>
        {/if}
      </div>

      {#if row.children.length && !folded}
        {#each row.children as child (child.builder.name)}
          <div class="rz-layers__child">
            <LayersList
              {form}
              list={child.list}
              depth={depth + 1}
              label={row.children.length > 1 ? child.label : undefined}
            />
          </div>
        {/each}
      {/if}
    </li>
  {/each}
</ul>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  /* One column as wide as the panel: a long title ends in an ellipsis instead of widening it. */
  .rz-layers__list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1px;
    min-height: var(--rz-size-2);
  }

  /*
   * A row at depth 1, 2, … starts one icon further in. Left of its icon, in that order: the grip,
   * then the chevron when it has children, both out of the flow.
   *
   *   icon    = 1.375rem
   *   gutter  = 0.5rem, the root row's own padding, + icon × (depth − 1)
   *   padding = gutter + grip 0.75rem + chevron 0.75rem + 0.25rem, gutter + 1.75rem
   */
  .rz-layers__list,
  .rz-layers__row,
  .rz-layers__child-label {
    --rz-layers-icon: --size(5.5);
    --rz-layers-gutter: calc(
      var(--rz-size-2) + var(--rz-layers-icon) * (var(--rz-layers-depth, 1) - 1)
    );
    --rz-layers-start: calc(var(--rz-layers-gutter) + --size(7));
  }

  .rz-layers__list[data-empty] {
    min-height: var(--rz-size-7);
    margin-left: var(--rz-layers-start);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-sm);
  }

  .rz-layers__row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    height: --size(8.5);
    padding-right: var(--rz-size-2);
    padding-left: var(--rz-layers-start);
    border-radius: var(--rz-radius-lg);
    font-size: var(--rz-text-md);
    color: var(--rz-fg-muted);
    cursor: grab;
    user-select: none;

    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  /* The selected row: shaded, its title in full weight. */
  .rz-layers__row--selected,
  .rz-layers__row--selected:hover {
    @mixin font-medium;
    background-color: var(--rz-bg-active);
    color: var(--rz-fg);
  }

  /* Says the row drags; the whole row does. */
  .rz-layers__grip {
    position: absolute;
    top: 50%;
    left: var(--rz-layers-gutter);
    display: flex;
    justify-content: center;
    width: var(--rz-size-3);
    transform: translateY(-50%);
    opacity: 0;
    color: var(--rz-fg-subtle);
  }

  .rz-layers__row:hover .rz-layers__grip {
    opacity: 1;
  }

  .rz-layers__edit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    color: var(--rz-fg-subtle);
    &:hover {
      color: var(--rz-fg);
      background-color: var(--rz-bg-hover);
    }
  }

  .rz-layers__toggle {
    position: absolute;
    top: 50%;
    left: calc(var(--rz-layers-gutter) + var(--rz-size-3));
    transform: translateY(-50%);
    display: flex;
    width: var(--rz-size-3);
    height: var(--rz-size-4);
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
  }

  .rz-layers__icon {
    display: grid;
    place-items: center;
    width: var(--rz-layers-icon);
    height: var(--rz-layers-icon);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-layers__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-layers__error {
    width: var(--rz-size-2);
    height: var(--rz-size-2);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-danger);
  }

  .rz-layers__child-label {
    display: block;
    padding-left: var(--rz-layers-start);
    padding-block: var(--rz-size-1);
    font-size: var(--rz-text-2xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rz-fg-subtle);
  }

  :global(.rz-layers__item.sortable-ghost > .rz-layers__row) {
    opacity: 0.4;
  }

  /* A type dragged in from the palette: a row of the layers, its name alone. */
  :global(.rz-layers__list > .rz-palette__item.rz-block-tile) {
    height: var(--rz-size-7);
    padding: 0 0 0 var(--rz-layers-start);
    border-radius: var(--rz-radius-sm);
    justify-content: center;
  }
  :global(
    .rz-layers__list > .rz-palette__item :is(.rz-block-tile__frame, .rz-block-tile__description)
  ) {
    display: none;
  }
</style>
