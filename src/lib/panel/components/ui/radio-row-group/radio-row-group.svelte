<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
  import './radio-row-group.css';

  let {
    ref = $bindable(null),
    class: className,
    value = $bindable(''),
    ...restProps
  }: RadioGroupPrimitive.RootProps = $props();
</script>

<RadioGroupPrimitive.Root
  bind:ref
  bind:value
  class="rz-radio-row-group {className}"
  {...restProps}
/>
