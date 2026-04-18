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

<div bind:this={ref} class="rz-calendar-months {className}" {...restProps}>
  {@render children?.()}
</div>

<style type="postcss">
  .rz-calendar-months {
    margin-top: var(--rz-size-4);
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-4);
  }

  @media (min-width: 640px) {
    .rz-calendar-months {
      flex-direction: row;
    }
  }
</style>
