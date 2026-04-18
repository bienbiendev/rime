<script lang="ts">
  import { Label as LabelPrimitive } from 'bits-ui';
  import './label.css';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: LabelPrimitive.RootProps & HTMLAttributes<HTMLLabelElement> = $props();
</script>

<LabelPrimitive.Root bind:ref class="rz-label {className}" {...restProps} />
