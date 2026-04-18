<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';
  import './sonner.css';

  let restProps: SonnerProps = $props();
</script>

<Sonner
  class="rz-toaster"
  toastOptions={{
    classes: {
      toast: 'rz-toaster__toast',
      description: 'rz-toaster__description',
      success: 'rz-toaster__success',
      error: 'rz-toaster__error',
      actionButton: 'rz-toaster__action',
      cancelButton: 'rz-toaster__cancel'
    }
  }}
  {...restProps}
/>
