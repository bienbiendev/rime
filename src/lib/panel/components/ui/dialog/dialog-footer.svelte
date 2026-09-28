<script lang="ts">
  import type { WithElementRef } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} class="rz-dialog-footer {className}" {...restProps}>
  {@render children?.()}
</div>

<style type="postcss">
  /* The buttons share the width, side by side; stacked, the first at the bottom, on a phone. */
  .rz-dialog-footer {
    display: flex;
    gap: var(--rz-size-3);
    flex-direction: column-reverse;
  }

  @media (min-width: 640px) {
    .rz-dialog-footer {
      flex-direction: row;
    }

    .rz-dialog-footer > :global(*) {
      flex: 1;
    }
  }
</style>
