<script lang="ts">
  import { apiUrl } from '$lib/core/api/index.js';
  import type { GenericDoc } from '$lib/core/types/doc.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { ChevronLeft } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';
  import LanguageSwitcher from '../../ui/language-switcher/LanguageSwitcher.svelte';
  import ButtonSave from './ButtonSave.svelte';

  type Props = { form: DocumentFormContext; onClose: any };
  const { form, onClose }: Props = $props();

  function onLocaleClick(code: string) {
    fetch(
      `${apiUrl(form.config.kebab)}?where[id][equals]=${form.values.id}&select=url&locale=${code}`
    )
      .then((response) => response.json())
      .then((data: { docs: GenericDoc[] }) => {
        if (Array.isArray(data.docs) && data.docs.length) {
          const url = data.docs[0].url;
          window.location.href = url + '?live=1';
        }
      })
      .catch((err) => {
        toast.error(`an error occured getting ${code} url`);
        console.error(err);
      });
  }
</script>

<div class="rz-floating-ui">
  <Button icon={ChevronLeft} onclick={onClose} variant="secondary" size="icon"></Button>
  {#if form.config.versions && form.config.versions.draft && form.values.status === 'published'}
    <ButtonSave
      label={t__('common.save')}
      class="rz-floating-ui__save"
      disabled={!form.canSubmit}
      processing={form.processing}
    />
  {:else if form.config.versions && form.config.versions.draft && form.values.status === 'draft'}
    <ButtonSave
      label={t__('common.save_draft')}
      class="rz-floating-ui__save"
      disabled={!form.canSubmit}
      processing={form.processing}
      data-draft
    />
  {:else}
    <ButtonSave
      label={t__('common.save')}
      class="rz-floating-ui__save"
      disabled={!form.canSubmit}
      processing={form.processing}
    />
  {/if}

  <LanguageSwitcher onLocalClick={onLocaleClick} />
</div>

<style>
  .rz-floating-ui {
    position: sticky;
    width: calc(100% - var(--rz-size-4));
    bottom: var(--rz-size-2);
    margin-left: var(--rz-size-2);
    margin-right: var(--rz-size-2);
    height: var(--rz-size-14);
    background-color: hsl(var(--rz-color-bg));
    padding: var(--rz-size-2);
    border-radius: var(--rz-radius-md);
    z-index: 1000;
    display: flex;
    gap: var(--rz-size-2);

    :global(.rz-floating-ui__save) {
      flex: 1;
    }
  }
</style>
