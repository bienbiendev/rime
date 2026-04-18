<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import './dropdown-menu-content.css';

  let {
    ref = $bindable(null),
    sideOffset = 4,
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.ContentProps = $props();
</script>

<DropdownMenuPrimitive.Content
  bind:ref
  {sideOffset}
  class="rz-dropdown-content {className}"
  {...restProps}
/>
