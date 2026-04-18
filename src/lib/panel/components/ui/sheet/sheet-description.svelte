<script lang="ts">
  import { Dialog as SheetPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.DescriptionProps = $props();
</script>

<SheetPrimitive.Description bind:ref class="rz-sheet-description {className}" {...restProps} />
