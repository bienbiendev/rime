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

<div bind:this={ref} class="rz-sheet-footer {className}" {...restProps}>
  {@render children?.()}
</div>
