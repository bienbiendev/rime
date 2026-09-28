<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { ArrowDown, ArrowUp, CopyPlus, Ellipsis, Maximize2, Trash2 } from '@lucide/svelte';

  type Props = {
    deleteBlock: () => void;
    duplicateBlock: () => void;
    moveUp?: () => void;
    moveDown?: () => void;
    focusBlock?: () => void;
  };

  const { deleteBlock, duplicateBlock, moveUp, moveDown, focusBlock }: Props = $props();
</script>

<!-- A ghost ⋯ on the row, its menu what the block can do; the moves are the keyboard's drag. -->
<div class="rz-block-actions">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          variant="ghost"
          size="icon-sm"
          icon={Ellipsis}
          title={t__('fields.block_actions')}
          aria-label={t__('fields.block_actions')}
          {...props}
        />
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end">
        {#if focusBlock}
          <DropdownMenu.Item onclick={focusBlock} data-focus-block>
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
        <DropdownMenu.Item onclick={duplicateBlock}>
          <CopyPlus size="12" />
          {t__('common.duplicate')}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item class="rz-block-actions__delete" onclick={deleteBlock}>
          <Trash2 size="12" />
          {t__('fields.delete_block')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style type="postcss">
  /* Quiet until the row is hovered or the menu is open. */
  .rz-block-actions {
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

  :global(.rz-block__header:is(:hover, :focus-within)) .rz-block-actions,
  .rz-block-actions:has(:global([data-state='open'])) {
    opacity: 1;
  }

  @media (hover: none) {
    .rz-block-actions {
      opacity: 1;
    }
  }

  :global(.rz-dropdown-item.rz-block-actions__delete) {
    color: var(--rz-danger);
  }
</style>
