<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { GenericBlock } from '$lib/core/prototype/types.js';
  import type { BlocksFieldBlock } from '$lib/fields/types';
  import { fieldset } from '$lib/panel/components/fields/fieldset.svelte.js';
  import { Field } from '$lib/panel/components/fields/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { normalizeFieldPath } from '$lib/util/string.js';
  import { Download, Maximize2 } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import AddBlockButton from './AddBlockButton.svelte';
  import Block from './Block.svelte';
  import { getBlocksFocusContext } from './focus/focus.svelte.js';
  import type { BlocksProps } from './props.js';

  const { path, config, form }: BlocksProps = $props();

  /** The document's focus mode, absent in a nested form. */
  const focus = getBlocksFocusContext();
  const list = $derived(normalizeFieldPath(path));
  /**
   * Where focus opens: a list inside a block on that block, `sections.1.items` on `sections.1`;
   * any other on itself.
   */
  const focusTarget = $derived.by(() => {
    const parts = list.split('.');
    const last = parts.findLastIndex((part) => /^\d+$/.test(part));
    if (last === -1 || !form.blocks.builder(parts.slice(0, last).join('.'))) return list;
    return parts.slice(0, last + 1).join('.');
  });
  const summary = $derived(config.get.layout === 'summary' && !!focus);

  const field = $derived(form.useField(path, config));
  const blockState = $derived(form.useBlocks(path));
  const count = $derived(blockState.blocks.length);
  let sorting = $state(false);

  const locale = getLocaleContext();

  /**
   * The blocks shown open, by id; the others are rows. The browser keeps the open ones:
   * `rz-block-open:<id>` is set while a block is open.
   */
  const OPEN_KEY = 'rz-block-open:';
  const opened = new SvelteSet<string>();
  const anyOpen = $derived(blockState.blocks.some((block) => opened.has(block.id)));

  onMount(() => {
    for (const block of blockState.blocks) {
      if (localStorage.getItem(OPEN_KEY + block.id)) opened.add(block.id);
    }
  });

  function setOpen(id: string, open: boolean) {
    if (open) {
      opened.add(id);
      localStorage.setItem(OPEN_KEY + id, '1');
    } else {
      opened.delete(id);
      localStorage.removeItem(OPEN_KEY + id);
    }
  }

  function toggleAll() {
    const open = !anyOpen;
    for (const block of blockState.blocks) setOpen(block.id, open);
  }

  /** A block added from the form opens, its fields ready to fill. */
  const add = (options: Omit<GenericBlock, 'id' | 'path'>) => {
    blockState.addBlock({ ...options, position: count });
    const added = blockState.blocks.at(-1);
    if (added) setOpen(added.id, true);
  };

  /** The copy opens when the block it copies is open. */
  const duplicate = (index: number) => {
    const source = blockState.blocks[index];
    blockState.duplicateBlock(index);
    const copy = blockState.blocks[index + 1];
    if (source && copy && opened.has(source.id)) setOpen(copy.id, true);
  };

  // svelte-ignore state_referenced_locally
  const { sortable } = useSortable({
    handle: '.rz-block__grip',
    group: path,
    animation: 150,
    onStart: () => (sorting = true),
    onUnchoose: () => (sorting = false),
    onEnd: (event) => {
      const { oldIndex, newIndex } = event;
      if (oldIndex !== undefined && newIndex !== undefined) {
        blockState.moveBlock(oldIndex, newIndex);
      }
      sorting = false;
    }
  });

  function sortableList(node: HTMLElement) {
    const instance = sortable(node);
    return { destroy: () => instance.destroy() };
  }

  function getConfigByBlockType(type: string): BlocksFieldBlock {
    const blockConfig = config.get.blocks.find((b) => type === b.name);
    if (!blockConfig) {
      throw new Error(`Block configuration not found for type: ${type}`);
    }
    return blockConfig.block;
  }
</script>

<fieldset class="rz-field-blocks {config.get.className || ''}" use:fieldset={field}>
  <!-- The label's line: its name, and on the right the ways to see the blocks. -->
  <div class="rz-blocks__header">
    <Field.Label {config} />
    <div class="rz-blocks__actions">
      {#if !summary && count > 1}
        <Button variant="ghost" size="sm" onclick={toggleAll}>
          {anyOpen ? t__('fields.collapse_all') : t__('fields.expand_all')}
        </Button>
      {/if}
      {#if focus && !summary}
        <Button
          variant="ghost"
          size="sm"
          icon={Maximize2}
          onclick={() => focus.open(focusTarget)}
          data-focus-open={list}
        >
          {t__('fields.open_editor')}
        </Button>
      {/if}
    </div>
  </div>
  <Field.Hint {config} />

  {#if summary && focus}
    <!-- One row: how many blocks, and the way into focus mode where they are edited. -->
    <div class="rz-blocks__summary">
      <span class="rz-blocks__count">
        {count === 1
          ? t__('fields.blocks_count', '1')
          : t__('fields.blocks_count|m|p', String(count))}
      </span>
      <Button
        onclick={() => focus.open(focusTarget)}
        size="sm"
        variant="ghost"
        icon={Maximize2}
        data-focus-open={list}
      >
        {t__('fields.edit')}
      </Button>
    </div>
  {:else}
    <!-- One raised card, a row per block. -->
    <div class="rz-blocks__list" data-empty={count ? null : ''} use:sortableList>
      {#each blockState.blocks as block, index (block.id)}
        <Block
          open={opened.has(block.id)}
          toggle={() => setOpen(block.id, !opened.has(block.id))}
          deleteBlock={() => blockState.deleteBlock(index)}
          duplicateBlock={() => duplicate(index)}
          moveUp={index > 0 ? () => blockState.moveBlock(index, index - 1) : undefined}
          moveDown={index < count - 1 ? () => blockState.moveBlock(index, index + 1) : undefined}
          focusBlock={focus ? () => focus.open(list, `${list}.${index}`) : undefined}
          {form}
          {sorting}
          path="{path}.{index}:{block.type}"
          config={getConfigByBlockType(block.type)}
        />
      {/each}
    </div>

    <div class="rz-blocks__actions-bottom">
      <AddBlockButton addBlock={add} {config} />

      {#if locale && locale.code !== locale.defaultCode && config.get.localized}
        <Button icon={Download} size="sm" onclick={field.setValueFromDefaultLocale} variant="ghost">
          {t__('fields.get_data_from')}
          {locale.defaultCode}
        </Button>
      {/if}
    </div>
  {/if}

  <Field.Error error={field.error} />
</fieldset>

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  .rz-blocks__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    min-height: var(--rz-size-7);
    margin-bottom: var(--rz-size-2);

    :global(.rz-field-label) {
      margin-bottom: 0;
      min-width: 0;
    }
  }

  .rz-blocks__header + :global(.rz-field-hint) {
    margin-top: 0;
    margin-bottom: var(--rz-size-2);
  }

  /* Small ghost buttons on the label's line and under the card, quiet until hovered. */
  .rz-blocks__actions,
  .rz-blocks__actions-bottom {
    display: flex;
    align-items: center;
    gap: var(--rz-size-0-5);

    :global(.rz-button:not(.rz-add-block)) {
      height: var(--rz-size-6);
      gap: var(--rz-size-1-5);
      padding-inline: var(--rz-size-2);
      color: var(--rz-fg-muted);
      font-size: var(--rz-text-sm);
    }

    :global(.rz-button__icon) {
      width: auto;
      height: auto;
      color: var(--rz-fg-subtle);
    }

    :global(.rz-button:hover:not(:disabled)),
    :global(.rz-button:hover:not(:disabled) .rz-button__icon) {
      color: var(--rz-fg);
    }
  }

  .rz-blocks__actions {
    margin-right: --size(-2);
  }

  .rz-blocks__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-4);
    min-height: var(--rz-size-11);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-3-5);
    @mixin surface raised;
    border-radius: var(--rz-radius-xl);

    :global(.rz-button) {
      height: var(--rz-size-7);
      color: var(--rz-fg-muted);
    }
    :global(.rz-button:hover:not(:disabled)) {
      color: var(--rz-fg);
    }
  }

  .rz-blocks__count {
    font-size: var(--rz-text-md);
    color: var(--rz-fg-subtle);
  }

  /* One raised card, the blocks its rows, a hairline between two. */
  .rz-blocks__list {
    --rz-blocks-radius: var(--rz-radius-xl);
    display: grid;
    /* One column the card's width: a long preview ellipsizes instead of widening the row. */
    grid-template-columns: minmax(0, 1fr);
    border-radius: var(--rz-blocks-radius);

    &:not([data-empty]) {
      @mixin surface raised;
    }

    > :global(.rz-block + .rz-block) {
      border-top: 1px solid var(--rz-border);
    }
  }

  /* Inside a group, a block or a tree item: a hairline, no second fill. */
  :global(.rz-group-field__content) :is(.rz-blocks__list:not([data-empty]), .rz-blocks__summary),
  :global(.rz-block__fields) :is(.rz-blocks__list:not([data-empty]), .rz-blocks__summary),
  :global(.rz-tree-item__fields) :is(.rz-blocks__list:not([data-empty]), .rz-blocks__summary) {
    background-color: transparent;
    box-shadow: 0 0 0 1px var(--rz-border);
  }

  /* Under the card: the add button on the left, the locale import on the right. */
  .rz-blocks__actions-bottom {
    justify-content: space-between;
    margin-top: var(--rz-size-2-5);
    margin-left: --size(-0.5);
  }

  .rz-blocks__list[data-empty] + .rz-blocks__actions-bottom {
    margin-top: 0;
  }

  /* The error sits under the field, clear of the buttons on the label's line. */
  .rz-field-blocks > :global(.rz-field-error) {
    position: static;
    display: inline-block;
    margin-top: var(--rz-size-1-5);
  }
</style>
