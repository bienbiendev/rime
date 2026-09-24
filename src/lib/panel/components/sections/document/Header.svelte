<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { BuiltArea, BuiltCollection } from '$lib/core/config/types';
  import { PARAMS } from '$lib/core/constants';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { ExternalLink, PencilRuler, X } from '@lucide/svelte';
  import { Button } from '../../ui/button';
  import CommandButton from '$lib/panel/components/sections/commands/CommandButton.svelte';
  import LanguageSwitcher from '../../ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '../../ui/page-header/PageHeader.svelte';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';
  import ButtonSave from './ButtonSave.svelte';
  import ButtonStatus from './ButtonStatus.svelte';
  import Settings from './Settings.svelte';

  // Props
  type Props = {
    onClose?: any;
    form: DocumentFormContext;
    config: BuiltArea | BuiltCollection;
    /** What a locale pick does; the document settles its unsaved changes before reloading. */
    onLocaleSwitch?: () => unknown;
  };
  const { form, onClose, config, onLocaleSwitch = invalidateAll }: Props = $props();

  const onCloseIsDefined = $derived(!!onClose);
  const locale = getLocaleContext();

  /**
   * A word on the auto-save, beside the buttons: a spinner while one is on its way, the reason
   * when one failed, else when the row on screen was auto-saved — this session's last one, or the
   * row's own time when it was resumed.
   */
  const showAutoSave = $derived(
    form.isAutoSave &&
      (form.autoSaveState === 'saving' || form.autoSaveState === 'paused' || form.values.isAutoSave)
  );
  const autoSavedAt = $derived(form.lastAutoSavedAt ?? form.values.updatedAt);

  function buildDocumentURL() {
    let url = form.values.url;
    if (url && form.values.versionId) {
      url = url.includes('?') ? `${url}&` : `${url}?`;
      url += `${PARAMS.VERSION_ID}=${form.values.versionId}`;
    }
    return url;
  }
</script>

{#snippet topLeft()}
  <Button onclick={() => onClose()} icon={X} variant="text">{t__('common.close')}</Button>
{/snippet}

<PageHeader topLeft={onCloseIsDefined ? topLeft : undefined}>
  {#snippet title()}
    {form.title}
  {/snippet}

  {#snippet bottomRight()}
    {#if showAutoSave}
      <span class="rz-auto-save-state" data-auto-save-state={form.autoSaveState}>
        {#if form.autoSaveState === 'saving'}
          <SpinLoader />
        {:else if form.autoSaveState === 'paused'}
          {t__('common.auto_save_paused', form.autoSaveReason ?? '')}
        {:else if autoSavedAt}
          {t__(
            'common.auto_saved_at',
            locale.dateFormat(autoSavedAt, { short: true, withTime: true })
          )}
        {/if}
      </span>
    {/if}

    {#if form.values.url}
      <Button
        icon={ExternalLink}
        target="_blank"
        href={buildDocumentURL()}
        size="icon-sm"
        variant="secondary"
      />
    {/if}

    {#if config.live && form.values._live}
      <Button
        size="icon-sm"
        variant="secondary"
        disabled={form.readOnly}
        class="rz-button-live"
        icon={PencilRuler}
        href={form.values._live}
      ></Button>
    {/if}

    {#if form.values.id}
      {/* @ts-ignore form doc is GenericDoc as form.values.id is defined */ null}
      <Settings {form} />
    {/if}

    {#if form.config.versions?.draft && form.values.id}
      <ButtonStatus {form} />
    {/if}
    <ButtonSave {form} size="sm" />
  {/snippet}

  {#snippet topRight()}
    <CommandButton />
    <LanguageSwitcher onLocalClick={onLocaleSwitch} />
  {/snippet}
</PageHeader>

<style lang="postcss">
  .rz-auto-save-state {
    display: inline-flex;
    align-items: center;
    font-size: var(--rz-text-xs);
    color: hsl(var(--rz-gray-10));
    white-space: nowrap;
  }
  .rz-auto-save-state[data-auto-save-state='paused'] {
    color: hsl(var(--rz-color-warn));
  }
</style>
