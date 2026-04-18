<script lang="ts">
  import { Dialog as SheetPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.OverlayProps = $props();

  export { className as class };
</script>

<SheetPrimitive.Overlay bind:ref class="rz-sheet-overlay {className}" {...restProps} />
