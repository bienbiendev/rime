<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import './dialog-description.css';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description bind:ref class="rz-dialog-description {className}" {...restProps} />
