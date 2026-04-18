<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import './dropdown-menu-group-heading.css';

  type Props = DropdownMenuPrimitive.GroupHeadingProps & {
    inset?: boolean;
  };

  let { ref = $bindable(null), class: className, inset, ...restProps }: Props = $props();

  const insetClass = $derived(inset ? 'rz-dropdown-menu-group-heading--inset' : '');
</script>

<DropdownMenuPrimitive.GroupHeading
  bind:ref
  class="rz-dropdown-menu-group-heading {insetClass} {className}"
  {...restProps}
/>
