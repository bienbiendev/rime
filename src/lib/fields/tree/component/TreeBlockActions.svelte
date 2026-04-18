<script lang="ts">
  import { Trash2 } from '@lucide/svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';

  type Props = {
    deleteItem: () => void;
  };

  const { deleteItem }: Props = $props();
</script>

<div class="rz-tree-item-actions">
  <Button variant="ghost" size="icon-sm" onclick={deleteItem}>
    <Trash2 size={11} />
  </Button>
</div>

<style type="postcss">
  .rz-tree-item-actions {
    display: flex;
    gap: var(--rz-size-2);
  }
</style>
