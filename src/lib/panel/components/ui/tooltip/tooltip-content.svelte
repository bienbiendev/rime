<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';
  import { fly } from 'svelte/transition';

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    children,
    ...restProps
  }: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Content bind:ref forceMount {sideOffset} {...restProps}>
  {#snippet child({ wrapperProps, props, open })}
    {#if open}
      <div {...wrapperProps}>
        <div {...props} class="rz-tooltip {className}" transition:fly={{ duration: 300 }}>
          {@render children?.()}
        </div>
      </div>
    {/if}
  {/snippet}
</TooltipPrimitive.Content>

<style lang="postcss">
  :root {
    --rz-tooltip-color-fg: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-2)));
    --rz-tooltip-color-bg: light-dark(hsl(var(--rz-gray-0)), hsl(var(--rz-gray-11)));
  }

  .rz-tooltip {
    background-color: var(--rz-tooltip-color-bg);
    color: var(--rz-tooltip-color-fg);
    padding: var(--rz-size-1-5) var(--rz-size-3);
    font-size: var(--rz-text-xs);
    z-index: 200;
    overflow: hidden;
    border-radius: var(--rz-radius-md);
  }
</style>
