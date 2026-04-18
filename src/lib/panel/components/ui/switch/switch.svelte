<script lang="ts">
  import { Switch as SwitchPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import './switch.css';

  let {
    ref = $bindable(null),
    class: className,
    checked = $bindable(false),
    ...restProps
  }: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();
</script>

<SwitchPrimitive.Root bind:ref bind:checked class="rz-switch {className}" {...restProps}>
  <SwitchPrimitive.Thumb class="rz-switch__thumb" />
</SwitchPrimitive.Root>
