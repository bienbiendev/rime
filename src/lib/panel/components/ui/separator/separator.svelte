<script lang="ts">
  import { Separator as SeparatorPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    orientation = 'horizontal',
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
  bind:ref
  class="rz-separator rz-separator--{orientation} {className}"
  {orientation}
  {...restProps}
/>

<style type="postcss">
  :global {
    .rz-separator {
      flex-shrink: 0;
      background-color: hsl(var(--rz-color-border));
    }
    .rz-separator--vertical {
      width: 1px;
      height: 100%;
    }
    .rz-separator--horizontal {
      height: 1px;
      width: 100%;
    }
  }
</style>
