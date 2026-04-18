<script lang="ts">
  import { X } from '@lucide/svelte';
  import { Dialog as SheetPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { SheetOverlay, SheetPortal, type Side } from './index.js';

  type Props = WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
    side?: Side;
    size?: 'default' | 'sm';
    children: Snippet;
    showCloseButton?: boolean;
  };

  let {
    ref = $bindable(null),
    class: className,
    side = 'right',
    size = 'default',
    children,
    showCloseButton = true,
    ...restProps
  }: Props = $props();
</script>

<SheetPortal>
  <SheetOverlay />
  <SheetPrimitive.Content
    bind:ref
    class="rz-sheet-content rz-sheet-content--{side} rz-sheet-content--{size} {className}"
    {...restProps}
  >
    {@render children?.()}

    {#if showCloseButton}
      <SheetPrimitive.Close class="rz-sheet-content__close">
        <X size="15" />
        <span class="rz-sr-only">Close</span>
      </SheetPrimitive.Close>
    {/if}
  </SheetPrimitive.Content>
</SheetPortal>
