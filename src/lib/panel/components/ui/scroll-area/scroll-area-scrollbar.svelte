<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive, type WithoutChild } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: Omit<WithoutChild<ScrollAreaPrimitive.ScrollbarProps>, 'orientation'> = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  orientation="vertical"
  class="rz-scroll-area-scroll-bar rz-scroll-area-scroll-bar--vertical {className}"
  {...restProps}
>
  <ScrollAreaPrimitive.Thumb class="rz-scroll-area-scroll-bar__thumb" />
</ScrollAreaPrimitive.Scrollbar>
