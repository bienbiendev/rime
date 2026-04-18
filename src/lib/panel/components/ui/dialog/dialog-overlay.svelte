<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import './dialog-overlay.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay bind:ref class="rz-dialog-overlay {className}" {...restProps} />
