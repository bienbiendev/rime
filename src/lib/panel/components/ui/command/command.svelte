<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import './command.css';

  let {
    ref = $bindable(null),
    value = $bindable(''),
    class: className,
    ...restProps
  }: CommandPrimitive.RootProps = $props();
</script>

<CommandPrimitive.Root class="rz-command {className}" bind:value bind:ref {...restProps} />
