<script lang="ts">
  import { Checkbox as CheckboxPrimitive, type WithoutChildrenOrChild } from 'bits-ui';
  import { Check } from '@lucide/svelte';
  import './checkbox.css';

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();

  const iconCheckedClass = $derived(!checked ? 'rz-checkbox__icon--unchecked' : '');
</script>

<CheckboxPrimitive.Root bind:ref class="rz-checkbox {className}" bind:checked {...restProps}>
  <div class="rz-checkbox__indicator">
    <Check class="rz-checkbox__icon {iconCheckedClass}" size={10} />
  </div>
</CheckboxPrimitive.Root>
