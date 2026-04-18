<script lang="ts">
  import { CopyPlus, Trash2 } from '@lucide/svelte';

  type Props = {
    deleteBlock: () => void;
    duplicateBlock: () => void;
  };

  const { deleteBlock, duplicateBlock }: Props = $props();
</script>

<div class="rz-block-actions">
  <button class="rz-block-action" type="button" onclick={duplicateBlock}>
    <CopyPlus size={11} />
  </button>
  <button class="rz-block-action" type="button" onclick={deleteBlock}>
    <Trash2 size={11} />
  </button>
</div>

<style type="postcss">
  .rz-block-actions {
    display: flex;
    gap: var(--rz-size-2);
  }
  .rz-block-action {
    border: var(--rz-border);
    border-radius: 1rem;
    height: var(--rz-size-6);
    width: var(--rz-size-6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.rz-block-actions__content) {
    width: auto;
    padding: var(--rz-size-1);
  }

  :global(.rz-block-actions__delete-button) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: flex-end;
    gap: var(--rz-size-3);
  }
</style>
