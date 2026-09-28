<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { ArrowDown, ArrowUp, Ellipsis, Trash2 } from '@lucide/svelte';

  type Props = {
    deleteItem: () => void;
    /** Absent on the first item of its list. */
    moveUp?: () => void;
    /** Absent on the last item of its list. */
    moveDown?: () => void;
  };

  const { deleteItem, moveUp, moveDown }: Props = $props();
</script>

<!-- A ghost ⋯ on the row, its menu what the item can do; the moves are the keyboard's drag. -->
<div class="rz-tree-item-actions">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          variant="ghost"
          size="icon-sm"
          icon={Ellipsis}
          title={t__('fields.item_actions')}
          aria-label={t__('fields.item_actions')}
          {...props}
        />
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item disabled={!moveUp} onclick={() => moveUp?.()}>
          <ArrowUp size="12" />
          {t__('fields.move_up')}
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={!moveDown} onclick={() => moveDown?.()}>
          <ArrowDown size="12" />
          {t__('fields.move_down')}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item class="rz-tree-item-actions__delete" onclick={deleteItem}>
          <Trash2 size="12" />
          {t__('fields.delete_item')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style type="postcss">
  /* Quiet until the row is hovered or the menu is open. */
  .rz-tree-item-actions {
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

  :global(.rz-tree-row:is(:hover, :focus-within)) .rz-tree-item-actions,
  .rz-tree-item-actions:has(:global([data-state='open'])) {
    opacity: 1;
  }

  @media (hover: none) {
    .rz-tree-item-actions {
      opacity: 1;
    }
  }

  :global(.rz-dropdown-item.rz-tree-item-actions__delete) {
    color: var(--rz-danger);
  }
</style>
