<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import type { Snippet } from 'svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps> & { children: Snippet } = $props();
</script>

<RadioGroupPrimitive.Item bind:ref class="rz-radio-row-group-item {className}" {...restProps}>
  {@render children()}
</RadioGroupPrimitive.Item>
