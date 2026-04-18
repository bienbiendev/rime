<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import './popover-content.css';

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    align = 'center',
    ...restProps
  }: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Content
  {sideOffset}
  {align}
  bind:ref
  class="rz-popover {className}"
  {...restProps}
/>
