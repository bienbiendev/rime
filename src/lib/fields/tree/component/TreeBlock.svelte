<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { TreeBlock } from '$lib/core/prototype/types.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { useOnce } from '$lib/panel/util/once.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import { ChevronDown, ChevronRight, GripVertical } from '@lucide/svelte';
  import { extractFieldName } from '../util.js';
  import AddItemButton from './AddItemButton.svelte';
  import TreeBlockComp from './TreeBlock.svelte';
  import TreeBlockActions from './TreeBlockActions.svelte';
  import type { TreeBlockProps } from './props.js';

  const { config, treeKey, treeState, form, sorting = false, path }: TreeBlockProps = $props();

  const depth = $derived(
    path
      .replace(`${treeState.path}.`, '')
      .split('.')
      .filter((str) => str !== '_children').length
  );
  const position = $derived(parseInt(path.split('.').pop() || '0'));
  const itemValue = $derived(form.getValue<TreeBlock>(path));
  const children = $derived(itemValue?._children ?? []);
  const parentPath = $derived(path.split('.').slice(0, -1).join('.'));
  const siblingsCount = $derived(form.getValue<TreeBlock[]>(parentPath)?.length ?? 0);
  /** Deep enough that nothing more goes inside. */
  const canHoldItems = $derived(depth <= config.get.maxDepth);

  // tree.0._children.2 -> 1.3
  const parentPathFormated = $derived.by(() => {
    if (depth === 1) return '';
    const [, relativePath] = extractFieldName(parentPath);
    return (
      relativePath
        .split('.')
        .filter((str) => str !== '_children')
        .map((str) => parseInt(str) + 1)
        .join('.') + '.'
    );
  });

  /** Open: its fields, then the items inside it, under its header. */
  let isOpen = $state(true);

  const { once } = useOnce();

  // A new item opens, its fields ready to fill; a saved one as it was left.
  once(() => {
    if (!itemValue) return;
    isOpen =
      itemValue.id.startsWith('temp-') || localStorage.getItem(`${itemValue.id}:open`) === 'true';
  });

  const toggleOpen = () => {
    isOpen = !isOpen;
    if (itemValue) localStorage.setItem(`${itemValue.id}:open`, isOpen.toString());
  };

  /** `renderTitle`, else the field's label and the item's place: `Links 1.2`. */
  const title = $derived.by(() => {
    const place = `${parentPathFormated}${position + 1}`;
    if (config.get.renderTitle) {
      try {
        const rendered = config.get.renderTitle({ position: place, values: itemValue || {} });
        if (rendered) return rendered;
      } catch (err) {
        console.error(`Can't render title in treeBlock`, err);
      }
    }
    return `${config.get.label || capitalize(config.name)} ${place}`;
  });

  // Paths relative to the tree: the move of a sibling up or down.
  const relative = (to: number) => `${parentPath}.${to}`.replace(`${treeState.path}.`, '');
  const moveUp = $derived(
    position > 0 ? () => treeState.moveItem(relative(position), relative(position - 1)) : undefined
  );
  const moveDown = $derived(
    position < siblingsCount - 1
      ? () => treeState.moveItem(relative(position), relative(position + 1))
      : undefined
  );

  const bodyId = $derived(`rz-tree-item-body-${itemValue?.id ?? path}`);
</script>

<!-- A card: its header, then, open, its fields and the items inside it. -->
<div
  class="rz-tree-item"
  data-path={path}
  data-tree-children={children.length}
  data-sorting={sorting}
  data-open={isOpen ? '' : null}
  data-deep={depth > 2 ? '' : null}
>
  <div class="rz-tree-item__header">
    <span class="rz-tree-item__grip" aria-hidden="true"><GripVertical size={12} /></span>

    <button
      type="button"
      class="rz-tree-item__toggle"
      aria-expanded={isOpen}
      aria-controls={bodyId}
      onclick={toggleOpen}
    >
      <span class="rz-tree-item__chevron">
        {#if isOpen}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
      </span>
      <span class="rz-tree-item__title">{title}</span>
      {#if !isOpen && children.length}
        <span class="rz-tree-item__count">{children.length}</span>
      {/if}
    </button>

    <TreeBlockActions
      {moveUp}
      {moveDown}
      deleteItem={() => treeState.deleteItem(parentPath, position)}
    />
  </div>

  <div class="rz-tree-item__body" id={bodyId} hidden={!isOpen}>
    <div class="rz-tree-item__fields">
      <RenderFields fields={config.get.fields} {path} {form} />
    </div>

    {#if canHoldItems}
      <div class="rz-tree-item__inside">
        <div class="rz-tree-item__inside-head">
          <span class="rz-tree-item__inside-title">
            {t__('fields.inside', title)}{#if children.length}&nbsp;· {children.length}{/if}
          </span>
          <AddItemButton
            class="rz-tree-item__add"
            size="sm"
            fields={config.get.fields}
            addItem={(values) => treeState.addItem(values, `${path}._children`)}
          >
            {t__('fields.add')}
          </AddItemButton>
        </div>

        <div
          class="rz-tree__list"
          data-path={path}
          data-tree-depth={depth}
          data-tree-key={treeKey}
          data-empty-label={t__('fields.nothing_inside')}
        >
          {#each children as child, index (child.id)}
            <TreeBlockComp
              {treeState}
              {form}
              {sorting}
              {treeKey}
              path="{path}._children.{index}"
              {config}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  /* A raised card; one inside another, a well; from the third level, a hairline alone. */
  .rz-tree-item {
    @mixin surface raised;
    border-radius: var(--rz-radius-xl);
  }

  .rz-tree-item :global(.rz-tree-item) {
    background-color: var(--rz-bg-well);
    box-shadow: 0 0 0 1px var(--rz-border);
  }

  .rz-tree-item[data-deep] {
    background-color: transparent;
  }

  /* Inside a group, a block or the inspector: a hairline, no second fill. */
  :global(:is(.rz-group-field__content, .rz-block__fields, .rz-inspector__fields)) .rz-tree-item {
    background-color: transparent;
    box-shadow: 0 0 0 1px var(--rz-border);
  }

  /* [grip][chevron title count][⋯] */
  .rz-tree-item__header {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--rz-row-height);
    padding-right: var(--rz-size-2);
  }

  .rz-tree-item[data-open] > .rz-tree-item__header {
    box-shadow: inset 0 -1px 0 var(--rz-border);
  }

  .rz-tree-item__grip {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    align-self: stretch;
    width: var(--rz-size-6);
    color: var(--rz-fg-subtle);
    opacity: 0.5;
    cursor: grab;
    transition: opacity 0.15s;
  }

  .rz-tree-item__header:hover .rz-tree-item__grip {
    opacity: 1;
  }

  /* The chevron and the title are one button: it opens the fields and the items inside. */
  .rz-tree-item__toggle {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    align-self: stretch;
    font-size: var(--rz-text-md);
    text-align: left;

    &:focus-visible {
      @mixin focus-ring;
      outline-offset: -2px;
    }
  }

  .rz-tree-item__chevron {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-4);
    color: var(--rz-fg-subtle);
  }

  .rz-tree-item__toggle:hover .rz-tree-item__chevron {
    color: var(--rz-fg);
  }

  .rz-tree-item__title {
    @mixin font-medium;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A closed item hiding an error: its title says so. */
  .rz-tree-item:not([data-open]):has(> .rz-tree-item__body :global(.rz-field-error))
    > .rz-tree-item__header
    .rz-tree-item__title {
    color: var(--rz-danger);
  }

  /* How many items a closed one holds. */
  .rz-tree-item__count {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    height: --size(4.5);
    padding-inline: var(--rz-size-1-5);
    border-radius: var(--rz-radius-full);
    background-color: var(--rz-bg-well);
    box-shadow: inset 0 0 0 1px var(--rz-border);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
  }

  .rz-tree-item__body[hidden] {
    display: none;
  }

  .rz-tree-item__fields {
    --rz-fields-padding: var(--rz-size-3-5);
    --rz-fields-gap: var(--rz-size-5);
    padding: var(--rz-size-4);
  }

  /* The items inside: a small heading, then their cards, inset a little. */
  .rz-tree-item__inside {
    padding: 0 var(--rz-size-3) var(--rz-size-3);
  }

  .rz-tree-item__inside-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    min-height: var(--rz-size-7);
    padding-left: var(--rz-size-1);
    margin-bottom: var(--rz-size-1-5);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);

    :global(.rz-add-item-button.rz-button) {
      height: var(--rz-size-6);
      font-size: var(--rz-text-sm);
    }
  }

  .rz-tree-item__inside-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-tree__list {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-2);
  }

  /* Nothing inside: a dashed zone to drop an item in. */
  .rz-tree__list:not(:has(> :global(.rz-tree-item)))::before {
    content: attr(data-empty-label);
    display: grid;
    place-items: center;
    min-height: var(--rz-size-10);
    padding: 0 var(--rz-size-3);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    text-align: center;
  }

  /* Picked up: the card shrinks to its header. */
  .rz-tree-item:global(.sortable-chosen) > .rz-tree-item__body {
    display: none;
  }

  /* Where it lands: its place kept, an accent line across it. */
  :global(.rz-field-tree .rz-tree-item.rz-tree-item--landing) {
    position: relative;
    background-color: transparent;
    box-shadow: none;

    > * {
      visibility: hidden;
    }

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
    }

    &::before {
      left: 0;
      right: 0;
      height: 2px;
      margin-top: -1px;
      border-radius: 2px;
      background-color: var(--rz-accent);
    }

    &::after {
      left: -4px;
      width: 8px;
      height: 8px;
      margin-top: -4px;
      border: 2px solid var(--rz-accent);
      border-radius: var(--rz-radius-full);
      background-color: var(--rz-bg-page);
    }
  }

  /* In hand: its header, floating over the page. */
  :global(.rz-tree-item.rz-tree-item--floating) {
    opacity: 1 !important;
    background-color: var(--rz-bg-float);
    box-shadow:
      0 0 0 1px var(--rz-border-strong),
      var(--rz-shadow-float);
    cursor: grabbing;

    > .rz-tree-item__body {
      display: none;
    }
    > .rz-tree-item__header {
      box-shadow: none;
    }
  }
</style>
