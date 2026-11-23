<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import Button from '../../ui/button/button.svelte';
  import type { ButtonSize, ButtonVariant } from '../../ui/button/index.js';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';

  type Props = {
    form: DocumentFormContext;
    size?: ButtonSize;
    /** `secondary` beside a Publish button, which is then the primary one. */
    variant?: ButtonVariant;
  };
  const { form, size = 'default', variant = 'default' }: Props = $props();

  const label = $derived(form.values.id ? t__('common.save') : t__('common.create'));

  // The form's plain save, written on the button. `data-submit` is how ⌘S and the version menu
  // find the button.
  const intent = $derived(form.saveIntent);
</script>

<Button
  {size}
  {variant}
  type="submit"
  disabled={!form.canSubmit}
  data-submit
  data-fork={intent.fork ? 'true' : undefined}
  data-status={intent.status}
>
  {#if form.processing}
    <SpinLoader />
  {/if}
  {label}
</Button>
