<script lang="ts">
  type Dic = Record<string, any>;

  type Props = {
    value: Dic | null;
  };

  const { value }: Props = $props();

  const blockCount = $derived(value ? value.length : 0);
  const blockLabel = $derived(blockCount === 1 ? 'block' : 'blocks');
</script>

<div class="rz-blocks-cell">
  {blockCount}
  {blockLabel}
</div>

<style type="postcss">
  .rz-blocks-cell {
    min-width: var(--rz-size-24);
  }
</style>
