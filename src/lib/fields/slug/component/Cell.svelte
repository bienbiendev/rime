<script lang="ts">
  let { value }: { value: string } = $props();
</script>

<span class="rz-slug-cell">{value}</span>

<style type="postcss">
  .rz-slug-cell {
    font-family: var(--rz-font-mono);
  }
</style>
