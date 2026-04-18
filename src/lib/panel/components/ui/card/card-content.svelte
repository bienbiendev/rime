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

<div bind:this={ref} class="rz-card-content {className}" {...restProps}>
  {@render children?.()}
</div>

<style>
  .rz-card-content {
    padding: var(--rz-size-6);
    padding-top: 0;
  }
  .rz-card-content > :global(* + *) {
    margin-top: var(--rz-size-4);
  }
</style>
