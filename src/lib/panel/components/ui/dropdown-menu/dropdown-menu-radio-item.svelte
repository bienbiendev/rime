<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive, type WithoutChild } from 'bits-ui';
  import { Check } from '@lucide/svelte';
  import './dropdown-menu-radio-item.css';

  let {
    ref = $bindable(null),
    class: className,
    children: childrenProp,
    ...restProps
  }: WithoutChild<DropdownMenuPrimitive.RadioItemProps> = $props();
</script>

<DropdownMenuPrimitive.RadioItem bind:ref class="rz-dropdown-radio {className}" {...restProps}>
  {#snippet children({ checked })}
    <span class="rz-dropdown-radio__indicator">
      {#if checked}
        <Check size="13" />
      {/if}
    </span>
    {@render childrenProp?.({ checked })}
  {/snippet}
</DropdownMenuPrimitive.RadioItem>
