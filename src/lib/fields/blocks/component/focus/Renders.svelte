<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { shiftListPath } from '$lib/panel/context/blocks-ops.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { ArrowDown, ArrowUp, CopyPlus, Focus, Trash2 } from '@lucide/svelte';
  import type Sortable from 'sortablejs';
  import DefaultRender from './DefaultRender.svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import Renders from './Renders.svelte';
  import StagePlaceholder from './StagePlaceholder.svelte';

  /**
   * `only` narrows the list to the block at that index, focus on one block: it does not move
   * then, its own lists do. `onRemove` asks first when the block holds blocks of its own.
   */
  type Props = { form: DocumentFormContext; list: string; only?: number; onRemove: () => void };
  const { form, list, only, onRemove }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const rows = $derived(
    only === undefined ? focus.rowsOf(list) : focus.rowsOf(list).filter((row) => row.index === only)
  );

  /**
   * A click selects the block, shows its fields, and stops there; a link inside a render does not
   * navigate.
   */
  function select(event: MouseEvent, rowPath: string) {
    event.stopPropagation();
    if ((event.target as Element).closest('a[href]')) event.preventDefault();
    focus.select(rowPath, { extend: event.shiftKey });
    focus.inspect();
  }

  /**
   * A click beside the blocks selects the list, so the next block goes at its end. A click on a
   * block stops at the block.
   */
  function selectList(event: MouseEvent) {
    event.stopPropagation();
    focus.selectList(list);
  }

  /**
   * "Type / to add a block" at the end of the list the next block goes to, so one on the stage.
   * An empty open list has its own message instead.
   */
  const placeholder = $derived(
    !focus.locked && list === focus.insertList() && (rows.length > 0 || list !== focus.path)
  );

  /** The one block the controls act on: selected alone, and the form open to changes. */
  const controlled = (rowPath: string) =>
    !focus.locked && focus.selection.length === 1 && focus.selection[0] === rowPath;

  /** A control does its job and stops there, before the block's own click selects it again. */
  function control(event: MouseEvent, action: () => unknown) {
    event.stopPropagation();
    action();
  }

  /**
   * An editable spot inside a render keeps the mouse, and so does a rich text's own drag handle;
   * the rest of the block drags.
   */
  const EDITABLE =
    'input, textarea, select, button, a[href], [contenteditable], .ProseMirror, .rz-rich-text-drag-handle';

  /**
   * The stage is in the same group as the layers: a block drags from one to the other, a type
   * drags in from the palette, and a nested list is a target like any other. The stage mounts a
   * list anew when focus moves, so `only` is read once.
   */
  // svelte-ignore state_referenced_locally
  const { sortable } = useSortable({
    group: {
      name: 'rz-blocks-layers',
      pull: true,
      put: (to, _from, dragged) =>
        form.blocks.accepts(to.el.dataset.list ?? '', (dragged as HTMLElement).dataset.type ?? '')
    },
    draggable: '.rz-renders__item',
    filter: EDITABLE,
    preventOnFilter: false,
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    disabled: focus.locked || only !== undefined,
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
  render puts where they go; a block without a render is a row with them under it.
-->
<div
  class="rz-renders"
  data-list={list}
  data-empty={rows.length ? undefined : ''}
  role="presentation"
  onclick={selectList}
  use:sortableList
>
  {#each rows as row (row.block.id)}
    {@const config = row.config}
    {@const Render = config?.render}
    {#snippet nested(name?: string)}
      {#each row.children.filter((child) => !name || child.builder.name === name) as child (child.builder.name)}
        <!-- All of them at once, and more than one: each under its name. -->
        {#if !name && row.children.length > 1}
          <p class="rz-renders__list-label">{child.label}</p>
        {/if}
        <Renders {form} list={child.list} {onRemove} />
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
      {#if controlled(row.path) && !focus.isNarrowedBlock(row.path)}
        <!-- Above it: move, duplicate, remove. A click on the block already opens its fields. -->
        <div class="rz-renders__toolbar">
          <button
            type="button"
            title={t__('fields.move_up')}
            aria-label={t__('fields.move_up')}
            disabled={row.index === 0}
            onclick={(event) => control(event, () => focus.moveSelection(-1))}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            title={t__('fields.move_down')}
            aria-label={t__('fields.move_down')}
            disabled={row.index === rows.length - 1}
            onclick={(event) => control(event, () => focus.moveSelection(1))}
          >
            <ArrowDown size={14} />
          </button>
          <span class="rz-renders__toolbar-separator" aria-hidden="true"></span>
          {#if row.children.length && focus.path !== row.path}
            <!-- The stage narrowed to this block and what it holds. -->
            <button
              type="button"
              title={t__('fields.focus_block')}
              aria-label={t__('fields.focus_block')}
              onclick={(event) => control(event, () => focus.open(row.path))}
            >
              <Focus size={14} />
            </button>
          {/if}
          <button
            type="button"
            title={t__('common.duplicate')}
            aria-label={t__('common.duplicate')}
            onclick={(event) => control(event, focus.duplicateSelection)}
          >
            <CopyPlus size={14} />
          </button>
          <button
            type="button"
            title={t__('fields.delete_block')}
            aria-label={t__('fields.delete_block')}
            onclick={(event) => control(event, onRemove)}
          >
            <Trash2 size={14} />
          </button>
        </div>
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
            <DefaultRender {row} {error} children={nested} />
          {/snippet}
        </svelte:boundary>
      {:else}
        <DefaultRender {row} children={nested} />
      {/if}
    </div>
  {:else}
    {#if list === focus.path}
      <p class="rz-renders__empty">{t__('fields.no_blocks_yet')}</p>
    {/if}
  {/each}
  {#if placeholder}
    <StagePlaceholder {list} compact={list !== focus.path} />
  {/if}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-renders {
    display: grid;
    gap: var(--rz-size-3);
    min-height: var(--rz-size-8);
  }

  /* An empty nested list: somewhere to drop a type. */
  .rz-renders[data-empty]:not([data-list='']) {
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-md);
  }

  /* A block under the pointer: a dashed frame, on the innermost block only. */
  .rz-renders__item {
    position: relative;
    border-radius: var(--rz-radius-md);
    outline: 1px dashed transparent;
    outline-offset: 3px;
    cursor: pointer;

    &:not([data-selected]):hover:not(:has(:global(.rz-renders__item:hover))) {
      outline-color: var(--rz-border-strong);
    }
    &:focus-visible {
      @mixin focus-ring;
      outline-offset: 3px;
    }
  }

  /* The selected block: an accent frame around it. */
  .rz-renders__item[data-selected] {
    outline: 1.5px solid var(--rz-accent);
    outline-offset: 3px;
  }

  :global(.rz-renders__item.sortable-ghost) {
    opacity: 0.4;
  }

  /* A type dragged in from the palette: the row the block will be, not the palette's tile. */
  :global(.rz-renders > .rz-palette__item.rz-block-tile) {
    flex-direction: row;
    align-items: center;
    gap: var(--rz-size-2);
    height: --size(11);
    padding: 0 var(--rz-size-3);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg);
  }
  :global(.rz-renders > .rz-palette__item .rz-block-tile__frame) {
    width: var(--rz-size-6);
    flex-shrink: 0;
    aspect-ratio: 1;
    border-radius: var(--rz-radius-sm);
  }
  :global(.rz-renders > .rz-palette__item .rz-block-tile__title) {
    padding-inline: 0;
  }
  :global(.rz-renders > .rz-palette__item .rz-block-tile__description) {
    display: none;
  }

  /* The name of a nested list, when a block holds several. */
  .rz-renders__list-label {
    margin-bottom: --size(-1.5);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
  }

  /*
   * The selected block's bar: dark, on its top edge at the right, half over the gap above, so it
   * covers little of the block before.
   */
  .rz-renders__toolbar {
    position: absolute;
    top: 0;
    right: var(--rz-size-3);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--rz-size-0-5);
    padding: var(--rz-size-1);
    border-radius: var(--rz-radius-lg);
    background-color: var(--rz-bg-inverse);
    color: var(--rz-fg-inverse);
    box-shadow: var(--rz-shadow-float);
    transform: translateY(-50%);
    cursor: default;

    button {
      display: grid;
      place-items: center;
      width: --size(6.5);
      height: --size(6.5);
      border-radius: var(--rz-radius-sm);
      opacity: 0.75;
      transition: opacity 0.15s;
      &:hover:not(:disabled) {
        opacity: 1;
        background-color: oklch(from var(--rz-fg-inverse) l c h / 0.12);
      }
      &:focus-visible {
        opacity: 1;
        @mixin focus-ring;
      }
      &:disabled {
        opacity: 0.3;
        cursor: default;
      }
    }
  }

  /* Moving on the left, the block's own actions on the right. */
  .rz-renders__toolbar-separator {
    width: 1px;
    height: var(--rz-size-4);
    margin-inline: var(--rz-size-1);
    background-color: oklch(from var(--rz-fg-inverse) l c h / 0.2);
  }

  /* A type dragged over an empty list takes the place of its message. */
  :global(.rz-renders:has(> :not(.rz-renders__empty)) > .rz-renders__empty) {
    display: none;
  }

  .rz-renders__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: var(--rz-fg-subtle);
  }
</style>
