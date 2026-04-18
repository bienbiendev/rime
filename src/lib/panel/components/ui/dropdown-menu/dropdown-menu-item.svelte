<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import './dropdown-menu-item.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.ItemProps & {
    inset?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.Item bind:ref class="rz-dropdown-item {className}" {...restProps} />
