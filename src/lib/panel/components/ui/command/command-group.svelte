<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import './command-group.css';

  let {
    ref = $bindable(null),
    class: className,
    children,
    heading,
    ...restProps
  }: CommandPrimitive.GroupProps & {
    heading?: string;
  } = $props();
</script>

<CommandPrimitive.Group class="rz-command-group {className}" bind:ref {...restProps}>
  {#if heading}
    <CommandPrimitive.GroupHeading class="rz-command-group__heading">
      {heading}
    </CommandPrimitive.GroupHeading>
  {/if}
  <CommandPrimitive.GroupItems {children} />
</CommandPrimitive.Group>
