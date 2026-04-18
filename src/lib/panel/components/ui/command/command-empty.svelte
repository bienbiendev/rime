<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';
  import './command-empty.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.EmptyProps = $props();
</script>

<CommandPrimitive.Empty class="rz-command-empty {className}" {...restProps} />
