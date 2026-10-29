<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive, type WithoutChild } from 'bits-ui';
  import Scrollbar from './scroll-area-scrollbar.svelte';
  import './scroll-area.css';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.RootProps> = $props();
</script>

<!-- A scroll area with a thin vertical bar. `class` styles the viewport, the element that
     scrolls. -->

<ScrollAreaPrimitive.Root bind:ref {...restProps}>
  <ScrollAreaPrimitive.Viewport class="rz-scroll-area__viewport rz-scroll-area {className}">
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  <Scrollbar />
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
