<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { BuiltArea, BuiltCollection } from '$lib/core/config/types';
  import { PARAMS } from '$lib/core/constants';
  import { t__ } from '$lib/core/i18n/index.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { formatWhen } from '$lib/panel/util/time.js';
  import { capitalize } from '$lib/util/string.js';
  import { ExternalLink, PencilRuler, X } from '@lucide/svelte';
  import { Button } from '../../ui/button';
  import LanguageSwitcher from '../../ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '../../ui/page-header/PageHeader.svelte';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';
  import ButtonSave from './ButtonSave.svelte';
  import ButtonStatus from './ButtonStatus.svelte';
  import DocumentUrl from './DocumentUrl.svelte';
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
  const { raw } = getConfigContext();

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

  /** The heading: the document's title, "Untitled" until it has one. */
  const untitled = $derived(!form.title || form.title === '[untitled]');
  const heading = $derived(untitled ? t__('common.untitled') : form.title);

  /**
   * The line under the heading: what the document is, then who edited it last, and when.
   *
   * ```
   * Page · edited by Anthony, 2 h ago     a collection's document
   * Edited yesterday                      an area, nobody named
   * Page                                  a document being created
   * ```
   *
   * A relative time reads mid-sentence, lowercased; a date keeps its case.
   */
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const meta = $derived.by(() => {
    const parts: string[] = [];
    if (config.type === 'collection') parts.push(config.label.singular);
    if (form.values.id && form.values.updatedAt) {
      const now = new Date();
      const formatted = formatWhen(form.values.updatedAt, now, raw.panel.language);
      const isRelative = now.getTime() - new Date(form.values.updatedAt).getTime() < WEEK;
      const when = isRelative ? formatted.charAt(0).toLowerCase() + formatted.slice(1) : formatted;
      const who = form.values.updatedBy?.name;
      parts.push(who ? t__('common.edited_by', who, when) : t__('common.edited', when));
    }
    return capitalize(parts.join(' · '));
  });

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

{#snippet title()}
  <span class="rz-document-title" data-empty={untitled ? '' : null}>{heading}</span>
{/snippet}

{#snippet metaLine()}
  <span class="rz-document-meta">{meta}</span>
{/snippet}

{#snippet urlLine()}
  <DocumentUrl {form} {config} />
{/snippet}

<!-- The bar: the breadcrumb, then the actions. Under it, the heading and the meta line. -->
<PageHeader
  topLeft={onCloseIsDefined ? topLeft : undefined}
  {title}
  meta={meta ? metaLine : undefined}
  aside={form.values.url ? urlLine : undefined}
>
  {#snippet topRight()}
    <!-- Ghost buttons, then the primary one: open, language, status, menu, save. -->
    <div class="rz-document-actions">
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
          variant="ghost"
          class="rz-document-actions__open"
          aria-label={t__('common.view_page')}
        />
      {/if}

      {#if config.live && form.values._live}
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={form.readOnly}
          class="rz-button-live"
          icon={PencilRuler}
          href={form.values._live}
        ></Button>
      {/if}

      {#if form.nestedLevel === 0}
        <LanguageSwitcher onLocalClick={onLocaleSwitch} />
      {/if}

      {#if form.config.versions?.draft && form.values.id}
        <ButtonStatus {form} />
      {/if}

      {#if form.values.id}
        {/* @ts-ignore form doc is GenericDoc as form.values.id is defined */ null}
        <Settings {form} />
      {/if}

      <ButtonSave {form} size="sm" />
    </div>
  {/snippet}
</PageHeader>

<style lang="postcss">
  /*
   * The bar's buttons, 28px high: ghost ones in the muted ink, their icons subtler, both
   * darkening on hover or while their menu is open; the primary one last, a little apart.
   */
  .rz-document-actions {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: flex;
    align-items: center;
    gap: var(--rz-size-0-5);

    :global(.rz-button) {
      height: var(--rz-size-7);
      gap: var(--rz-size-1-5);
      padding-inline: var(--rz-size-2-5);
    }

    :global(.rz-button--size-icon-sm) {
      width: var(--rz-size-7);
      padding: 0;
    }

    :global(.rz-button__icon) {
      width: auto;
      height: auto;
    }

    :global(.rz-button--ghost svg) {
      color: var(--rz-fg-subtle);
      transition: color 0.15s;
    }

    :global(
      .rz-button--ghost:is(:hover, [aria-expanded='true'], [data-state='open']):not(:disabled)
    ) {
      color: var(--rz-fg);
    }

    :global(
      .rz-button--ghost:is(:hover, [aria-expanded='true'], [data-state='open']):not(:disabled) svg
    ) {
      color: var(--rz-fg);
    }

    :global(.rz-button--default) {
      margin-left: var(--rz-size-1-5);
      padding-inline: var(--rz-size-3);
    }
  }

  .rz-auto-save-state {
    display: inline-flex;
    align-items: center;
    margin-right: var(--rz-size-2);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
    white-space: nowrap;
  }
  .rz-auto-save-state[data-auto-save-state='paused'] {
    color: var(--rz-warn);
  }

  /* On a narrow page the auto-save note and the open button go. */
  @container main (max-width: 30rem) {
    .rz-auto-save-state,
    .rz-document-actions :global(.rz-document-actions__open) {
      display: none;
    }
  }

  .rz-document-title[data-empty] {
    color: var(--rz-fg-subtle);
  }

  .rz-document-meta {
    font-size: var(--rz-text-sm);
  }
</style>
