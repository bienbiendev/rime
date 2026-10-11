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

<ScrollAreaPrimitive.Root bind:ref {...restProps}>
  <ScrollAreaPrimitive.Viewport class="rz-scroll-area__viewport rz-scroll-area {className}">
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  <Scrollbar orientation="vertical" />
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
