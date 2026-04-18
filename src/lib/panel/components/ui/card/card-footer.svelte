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

<div bind:this={ref} class="rz-card-footer {className}" {...restProps}>
  {@render children?.()}
</div>

<style>
  .rz-card-footer {
    display: flex;
    gap: var(--rz-size-3);
    align-items: center;
    padding: var(--rz-size-6);
    padding-top: 0;
  }
</style>
