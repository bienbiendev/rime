<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import './dialog-title.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title bind:ref class="rz-dialog-title {className}" {...restProps} />
