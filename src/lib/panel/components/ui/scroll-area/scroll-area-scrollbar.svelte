<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive, type WithoutChild } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    orientation = 'vertical',
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.ScrollbarProps> = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  {orientation}
  class="rz-scroll-area-scroll-bar rz-scroll-area-scroll-bar--{orientation}  {className}"
  {...restProps}
>
  <ScrollAreaPrimitive.Thumb class="rz-scroll-area-scroll-bar__thumb" />
</ScrollAreaPrimitive.Scrollbar>
