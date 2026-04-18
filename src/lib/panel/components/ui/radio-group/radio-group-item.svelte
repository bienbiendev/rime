<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive, type WithoutChildrenOrChild } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> = $props();
</script>

<RadioGroupPrimitive.Item bind:ref class="rz-radio-group-item {className}" {...restProps}
></RadioGroupPrimitive.Item>
