<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';

  type PrimitiveElementAttributes = WithElementRef<HTMLAttributes<HTMLElement>>;
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PrimitiveElementAttributes = $props();
</script>

<p bind:this={ref} class="rz-card-description {className}" {...restProps}>
  {@render children?.()}
</p>

<style type="postcss">
  .rz-card-description {
    font-size: var(--rz-text-sm);
    @mixin color color-fr, 0.7;
  }
</style>
