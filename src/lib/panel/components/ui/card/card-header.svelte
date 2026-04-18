<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';
  type PrimitiveDivAttributes = WithElementRef<HTMLAttributes<HTMLDivElement>>;

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PrimitiveDivAttributes = $props();
</script>

<div bind:this={ref} class="rz-card-header {className}" {...restProps}>
  {@render children?.()}
</div>

<style>
  .rz-card-header {
    display: flex;
    gap: var(--rz-size-1-5);
    padding: var(--rz-size-6);
  }
</style>
