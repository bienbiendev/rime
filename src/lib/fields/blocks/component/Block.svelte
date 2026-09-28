<script lang="ts">
  import type { GenericBlock } from '$lib/core/prototype/types.js';
  import type { BlocksFieldBlock } from '$lib/fields/types';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { type DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import { GripVertical, ToyBrick } from '@lucide/svelte';
  import BlockActions from './BlockActions.svelte';

  type Props = {
    config: BlocksFieldBlock;
    path: string;
    form: DocumentFormContext;
    /** Its fields on show under its row. */
    open: boolean;
    sorting: boolean;
    toggle: () => void;
    deleteBlock: () => void;
    duplicateBlock: () => void;
    /** Absent on the first block. */
    moveUp?: () => void;
    /** Absent on the last block. */
    moveDown?: () => void;
    /** Opens the document's focus mode on this block; absent in a nested form. */
    focusBlock?: () => void;
  };

  const {
    config,
    path,
    form,
    open,
    sorting = false,
    toggle,
    deleteBlock,
    duplicateBlock,
    moveUp,
    moveDown,
    focusBlock
  }: Props = $props();

  const position = $derived(parseInt(path.split('.').pop() || '0'));
  const blockValue = $derived(form.getValue<GenericBlock>(path));

  const title = $derived.by(() => {
    if (config.renderTitle) {
      try {
        const rendered = config.renderTitle({ values: blockValue || {}, position });
        if (rendered) return rendered;
      } catch (err) {
        console.error(`Can't render title in block`, err);
      }
    }
    return config.label ? config.label : capitalize(config.name);
  });

  const fieldsId = $derived(`rz-block-fields-${blockValue?.id ?? path}`);
  const BlockIcon = $derived(config.icon || ToyBrick);
</script>

<!-- A row: grip, icon, name, actions. A click on it shows its fields under it. -->
<div class="rz-block" data-open={open ? '' : null} data-sorting={sorting}>
  <div class="rz-block__header">
    <span class="rz-block__grip" aria-hidden="true">
      <GripVertical size={15} />
    </span>

    <button
      type="button"
      class="rz-block__title-button"
      aria-expanded={open}
      aria-controls={fieldsId}
      onclick={toggle}
    >
      <span class="rz-block__icon"><BlockIcon size={14} /></span>
      <span class="rz-block__heading">{title}</span>
    </button>

    <BlockActions {duplicateBlock} {deleteBlock} {moveUp} {moveDown} {focusBlock} />
  </div>

  <div class="rz-block__fields" id={fieldsId} hidden={!open}>
    <RenderFields fields={config.fields} {path} {form} />
  </div>
</div>

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  /*
   * One row of the list's card. The list's radius, `--rz-blocks-radius`, rounds the first and the
   * last row so their tint stays inside the card.
   */
  .rz-block {
    --rz-fields-padding: var(--rz-size-5);
    position: relative;

    &:first-child,
    &:first-child > .rz-block__header {
      border-top-left-radius: var(--rz-blocks-radius, 0);
      border-top-right-radius: var(--rz-blocks-radius, 0);
    }
    &:last-child,
    &:last-child:not([data-open]) > .rz-block__header {
      border-bottom-left-radius: var(--rz-blocks-radius, 0);
      border-bottom-right-radius: var(--rz-blocks-radius, 0);
    }
  }

  /* Open, the row and its fields read as one: a hairline around both, another between them. */
  .rz-block[data-open] {
    outline: 1px solid var(--rz-border-strong);
    outline-offset: -1px;

    > .rz-block__header {
      border-bottom: 1px solid var(--rz-border);
    }
  }

  /* Closed on a field with an error: a red edge, since the field itself is out of sight. */
  .rz-block:not([data-open]):has(:global(.rz-field-error)) {
    outline: 1px solid var(--rz-danger);
    outline-offset: -1px;
  }

  .rz-block__header {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-height: var(--rz-size-11);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-1);
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--rz-bg-hover);
    }
  }

  /* The handle the list drags by, shown with the row's hover. */
  .rz-block__grip {
    display: flex;
    flex-shrink: 0;
    color: var(--rz-fg-subtle);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .rz-block__header:is(:hover, :focus-within) .rz-block__grip {
    opacity: 1;
  }

  @media (hover: none) {
    .rz-block__grip {
      opacity: 1;
    }
  }

  .rz-block__title-button {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--rz-size-2-5);
    min-width: 0;
    align-self: stretch;
    font-size: var(--rz-text-md);
    text-align: left;

    &:focus-visible {
      @mixin focus-ring;
      outline-offset: -2px;
    }
  }

  .rz-block__icon {
    display: grid;
    place-items: center;
    width: --size(6.5);
    height: --size(6.5);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-block__heading {
    @mixin font-medium;
    min-width: 0;
    overflow: hidden;
    color: var(--rz-fg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-block__fields {
    padding: var(--rz-size-5) 0;

    &[hidden] {
      display: none;
    }
  }

  /* While the list sorts, the rows show their name and nothing to click. */
  .rz-block[data-sorting='true'] :global(.rz-block-actions) {
    visibility: hidden;
  }

  .rz-block:global(.sortable-ghost) > .rz-block__header {
    opacity: 0.4;
  }
</style>
