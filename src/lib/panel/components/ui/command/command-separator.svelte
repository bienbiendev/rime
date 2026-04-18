<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import './command-separator.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.SeparatorProps = $props();
</script>

<CommandPrimitive.Separator class="rz-command-separator {className}" bind:ref {...restProps} />
