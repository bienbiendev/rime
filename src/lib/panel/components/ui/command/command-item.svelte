<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import './command-item.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.ItemProps = $props();
</script>

<CommandPrimitive.Item class="rz-command-item {className}" bind:ref {...restProps} />
