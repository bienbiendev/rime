<script lang="ts">
  import { Dialog as SheetPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title bind:ref class="rz-sheet-title {className}" {...restProps} />
