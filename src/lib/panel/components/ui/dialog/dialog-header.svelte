<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { WithElementRef } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} class="rz-dialog-header {className}" {...restProps}>
  {@render children?.()}
</div>

<style type="postcss">
  .rz-dialog-header {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-1-5);
    text-align: center;
    @mixin font-semibold;
  }

  @media (min-width: 640px) {
    .rz-dialog-header {
      text-align: left;
    }
  }
</style>
