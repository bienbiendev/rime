<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import X from '@lucide/svelte/icons/x';
  import { Dialog as SheetPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import { createLayer } from '../layer/layer.svelte.js';
  import { SheetOverlay, SheetPortal, type Side } from './index.js';

  type Props = WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
    /** The edge it slides from; `right` is the only one. */
    side?: Side;
    /** `sm`: a narrow side panel beside the page, 20rem at most. */
    size?: 'default' | 'sm';
    children: Snippet;
    /** A ✕ in the top right corner, styled by sheet.css and by dialog-content.css. */
    showCloseButton?: boolean;
  };

  let {
    ref = $bindable(null),
    class: className,
    style,
    side = 'right',
    size = 'default',
    children,
    showCloseButton = true,
    ...restProps
  }: Props = $props();

  const layer = createLayer();
</script>

<!-- The content raises the sheet above the modals open before it; the overlay shares its level. -->
<SheetPortal>
  <SheetOverlay style="--rz-modal-level: {layer.level}" />
  <SheetPrimitive.Content
    {@attach layer.raise}
    bind:ref
    class="rz-sheet-content rz-sheet-content--{side} rz-sheet-content--{size} {className}"
    style="--rz-modal-level: {layer.level}; {style}"
    {...restProps}
  >
    {@render children?.()}

    {#if showCloseButton}
      <SheetPrimitive.Close class="rz-sheet-content__close">
        <X size="15" />
        <span class="rz-sr-only">{t__('common.close')}</span>
      </SheetPrimitive.Close>
    {/if}
  </SheetPrimitive.Content>
</SheetPortal>
