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
  @import '../../../style/mixins/index.css';

  :root {
    --rz-card-color-bg: var(--rz-bg-raised);
  }
  .rz-card {
    width: var(--rz-card-width, auto);
    @mixin surface raised;
    background-color: var(--rz-card-color-bg);
    border-radius: var(--rz-radius-lg);
  }
</style>
