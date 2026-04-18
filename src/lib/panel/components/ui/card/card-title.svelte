<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { CardHeadingLevel } from './index.js';
  import type { HTMLAttributes } from 'svelte/elements';
  type PrimitiveDivAttributes = WithElementRef<HTMLAttributes<HTMLDivElement>>;

  let {
    ref = $bindable(null),
    class: className,
    level = 3,
    children,
    ...restProps
  }: PrimitiveDivAttributes & {
    level?: CardHeadingLevel;
  } = $props();
</script>

<div
  role="heading"
  aria-level={level}
  bind:this={ref}
  class="rz-card-title {className}"
  {...restProps}
>
  {@render children?.()}
</div>

<style type="postcss">
  .rz-card-title {
    @mixin font-semibold;
  }
</style>
