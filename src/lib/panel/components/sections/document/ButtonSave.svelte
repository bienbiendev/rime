<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { Save } from '@lucide/svelte';
  import Button from '../../ui/button/button.svelte';
  import type { ButtonSize, ButtonVariant } from '../../ui/button/index.js';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';

  type Props = {
    form: DocumentFormContext;
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
  };
  const { form, variant = 'default', size = 'default', class: className }: Props = $props();

  const label = $derived(form.values.id ? t__('common.save') : t__('common.create'));

  /**
   * What the save does, said on the button and read off the submitter by the form:
   *
   * ```
   * no versions                       save in place
   * versions, no draft                data-fork: a version per save
   * versions and draft, published     data-status: the save keeps it published
   * versions and draft, draft         save the draft
   * ```
   *
   * `data-submit` is how ⌘S and the settings menu find the button.
   */
  const versions = $derived(form.config.versions);
  const fork = $derived(!!versions && !versions.draft);
  const status = $derived(
    versions && versions.draft && form.values.status === 'published' ? 'published' : undefined
  );
</script>

<Button
  {variant}
  {size}
  class={className || null}
  type="submit"
  disabled={!form.canSubmit}
  data-submit
  data-fork={fork ? '' : undefined}
  data-status={status}
>
  {#if form.processing}
    <SpinLoader />
  {:else}
    <Save size="13" />
  {/if}
  {label}
</Button>
