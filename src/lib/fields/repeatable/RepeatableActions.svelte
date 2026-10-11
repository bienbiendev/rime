<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import Button from '#lib/panel/components/ui/button/button.svelte';
  import * as DropdownMenu from '#lib/panel/components/ui/dropdown-menu/index.js';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import CopyPlus from '@lucide/svelte/icons/copy-plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  type Props = {
    /** The menu's name for screen readers: `fields.block_actions` or `fields.item_actions`. */
    label: string;
    deleteLabel: string;
    onDelete: () => void;
    /** Absent on the first row of its list. */
    moveUp?: () => void;
    /** Absent on the last row of its list. */
    moveDown?: () => void;
    onDuplicate?: () => void;
    onFocus?: () => void;
  };

  const { label, deleteLabel, onDelete, moveUp, moveDown, onDuplicate, onFocus }: Props = $props();
</script>

<!-- A ghost ⋯ on the row, its menu what the row can do. The moves stand in for a drag on the keyboard. -->
<div class="rz-repeatable-actions">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          variant="ghost"
          size="icon-sm"
          icon={Ellipsis}
          title={label}
          aria-label={label}
          {...props}
        />
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end">
        {#if onFocus}
          <DropdownMenu.Item onclick={onFocus} data-focus-block>
            <Maximize2 size="12" />
            {t__('fields.open_in_editor')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
        {/if}
        <DropdownMenu.Item disabled={!moveUp} onclick={() => moveUp?.()}>
          <ArrowUp size="12" />
          {t__('fields.move_up')}
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={!moveDown} onclick={() => moveDown?.()}>
          <ArrowDown size="12" />
          {t__('fields.move_down')}
        </DropdownMenu.Item>
        {#if onDuplicate}
          <DropdownMenu.Item onclick={onDuplicate}>
            <CopyPlus size="12" />
            {t__('common.duplicate')}
          </DropdownMenu.Item>
        {/if}
        <DropdownMenu.Separator />
        <DropdownMenu.Item class="rz-repeatable-actions__delete" onclick={onDelete}>
          <Trash2 size="12" />
          {deleteLabel}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style type="postcss">
  /* Quiet until the row is hovered or the menu is open. */
  .rz-repeatable-actions {
    --rz-button-ghost-fg: var(--rz-fg-subtle);
    display: flex;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;

    :global(.rz-button) {
      width: var(--rz-size-7);
      height: var(--rz-size-7);
    }
    :global(.rz-button:hover),
    :global(.rz-button[data-state='open']) {
      color: var(--rz-fg);
    }
  }

  /* The ⋯ shows while its row header is hovered or focused, or while its menu is open */
  :global([data-repeatable-header]:is(:hover, :focus-within)) .rz-repeatable-actions,
  .rz-repeatable-actions:has(:global([data-state='open'])) {
    opacity: 1;
  }

  @media (hover: none) {
    .rz-repeatable-actions {
      opacity: 1;
    }
  }

  :global(.rz-dropdown-item.rz-repeatable-actions__delete) {
    color: var(--rz-danger);
  }
</style>
