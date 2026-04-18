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

<div bind:this={ref} class="rz-card {className}" {...restProps}>
  {@render children?.()}
</div>

<style type="postcss">
  :root {
    --rz-card-color-bg: hsl(var(--rz-color-bg));
  }
  .rz-card {
    width: var(--rz-card-width, auto);
    background-color: var(--rz-card-color-bg);
    border-radius: var(--rz-radius-lg);
    border: var(--rz-border);
  }
</style>
