<script lang="ts">
  import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
  import { getFieldAtPath } from '#lib/core/fields/util.js';
  import { t__ } from '#lib/core/i18n/index.js';
  import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
  import { titleOrUntitled } from '#lib/panel/util/title.js';
  import { getConfigContext } from '#lib/panel/context/config.svelte.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import { errorText } from '#lib/panel/util/error-text.js';
  import { formatWhen, isRelative } from '#lib/panel/util/time.js';
  import { capitalize } from '#lib/util/string.js';
  import X from '@lucide/svelte/icons/x';
  import { Button } from '../../ui/button';
  import LanguageSwitcher from '../../ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '../../ui/page-header/PageHeader.svelte';
  import SpinLoader from '../../ui/spin-loader/SpinLoader.svelte';
  import ButtonPublish from './ButtonPublish.svelte';
  import ButtonSave from './ButtonSave.svelte';
  import DocumentUrl from './DocumentUrl.svelte';
  import Settings from './Settings.svelte';
  import VersionMenu from './VersionMenu.svelte';

  // Props
  type Props = {
    onClose?: any;
    form: DocumentFormContext;
    config: BuiltArea | BuiltCollection;
    /** What a locale pick does; the document settles its unsaved changes before switching. */
    onLocaleSwitch: (code: string) => unknown;
  };
  const { form, onClose, config, onLocaleSwitch }: Props = $props();

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
  const untitled = $derived(!form.title);
  const heading = $derived(titleOrUntitled(form.title));

  /** The title field the heading edits, `isTitle('inline')`; its label names the input. */
  const titleField = $derived(form.inlineTitle ? form.useField<string>(form.inlineTitle) : null);
  const titleLabel = $derived(
    form.inlineTitle ? getFieldAtPath(form.inlineTitle, config.fields)?.get.label : undefined
  );

  /**
   * The line under the heading: what the document is, then who edited it last, and when.
   *
   * ```
   * Page · edited by Email, 2 h ago     a collection's document
   * Edited yesterday                      an area, nobody named
   * Page                                  a document being created
   * ```
   *
   * A relative time reads mid-sentence, lowercased; a date keeps its case.
   */
  const meta = $derived.by(() => {
    const parts: string[] = [];
    if (config.type === 'collection') parts.push(config.label.singular);
    if (form.values.id && form.values.updatedAt) {
      const now = new Date();
      const formatted = formatWhen(form.values.updatedAt, now, raw.panel.language);
      const when = isRelative(form.values.updatedAt, now)
        ? formatted.charAt(0).toLowerCase() + formatted.slice(1)
        : formatted;
      const who = form.values.updatedBy?.name;
      parts.push(who ? t__('common.edited_by', who, when) : t__('common.edited', when));
    }
    return capitalize(parts.join(' · '));
  });

  /** A saved draft gets Publish, the primary button, and Save steps back beside it. */
  const canPublish = $derived(
    !!config.versions?.draft && !!form.values.id && form.values.status !== VERSIONS_STATUS.PUBLISHED
  );
</script>

{#snippet topLeft()}
  <Button onclick={() => onClose()} icon={X} variant="text">{t__('common.close')}</Button>
{/snippet}

{#snippet title()}
  {#if titleField}
    <input
      class="rz-document-title-input"
      id={form.inlineTitle}
      name={form.inlineTitle}
      aria-label={titleLabel}
      aria-invalid={titleField.error ? 'true' : undefined}
      aria-describedby={titleField.error ? 'rz-document-title-error' : undefined}
      placeholder={t__('common.untitled')}
      autocomplete="off"
      size={Math.max((titleField.value || t__('common.untitled')).length, 1)}
      value={titleField.value ?? ''}
      readonly={!titleField.editable}
      oninput={(event) => (titleField.value = event.currentTarget.value)}
    />
  {:else}
    <span class="rz-document-title" data-empty={untitled ? '' : null}>{heading}</span>
  {/if}
{/snippet}

{#snippet titleEnd()}
  {/* @ts-ignore form doc is GenericDoc as form.values.id is defined */ null}
  <Settings {form} />
{/snippet}

{#snippet metaLine()}
  {#if titleField?.error}
    <span id="rz-document-title-error" class="rz-document-title-error">
      {errorText(titleField.error)}
    </span>
  {:else}
    <span class="rz-document-meta">{meta}</span>
  {/if}
{/snippet}

{#snippet urlLine()}
  <DocumentUrl {form} {config} />
{/snippet}

<!--
  The bar: the breadcrumb, then the language, the version menu and the save buttons. Under it, the
  heading with the document's menu, the meta line and the url.
-->
<PageHeader
  topLeft={onCloseIsDefined ? topLeft : undefined}
  {title}
  titleEnd={form.values.id ? titleEnd : undefined}
  meta={meta || titleField?.error ? metaLine : undefined}
  aside={form.values.url ? urlLine : undefined}
>
  {#snippet topRight()}
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

      {#if form.nestedLevel === 0}
        <LanguageSwitcher onLocalClick={onLocaleSwitch} />
      {/if}

      {#if config.versions && form.values.id}
        {/* @ts-ignore form doc is GenericDoc as form.values.id is defined */ null}
        <VersionMenu {form} />
      {/if}

      <ButtonSave {form} size="sm" variant={canPublish ? 'secondary' : 'default'} />

      {#if canPublish}
        <ButtonPublish {form} />
      {/if}
    </div>
  {/snippet}
</PageHeader>

<style lang="postcss">
  /*
   * The bar's buttons, 28px high: ghost ones in the muted ink, their icons subtler, both
   * darkening on hover or while their menu is open; the save buttons last, a little apart.
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

    :global(:is(.rz-button--default, .rz-button--secondary)) {
      padding-inline: var(--rz-size-3);
    }

    :global([data-submit]) {
      margin-left: var(--rz-size-1-5);
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

  /* On a narrow page the auto-save note goes. */
  @container main (max-width: 30rem) {
    .rz-auto-save-state {
      display: none;
    }
  }

  .rz-document-title[data-empty] {
    color: var(--rz-fg-subtle);
  }

  /*
   * The title field as the heading: the heading's type and no box, as wide as its text. A line
   * under it on hover, the accent's while typing, the danger's on an error.
   */
  .rz-document-title-input {
    /* One line of the heading, empty with its placeholder or filled. */
    display: block;
    height: 1lh;
    field-sizing: content;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    line-height: inherit;
    outline: none;
    transition: box-shadow 0.15s;

    &::placeholder {
      color: var(--rz-fg-subtle);
    }

    &:hover:not(:read-only) {
      box-shadow: inset 0 -1px 0 var(--rz-border-strong);
    }

    &:focus-visible {
      box-shadow: inset 0 -2px 0 var(--rz-accent);
    }

    &[aria-invalid] {
      box-shadow: inset 0 -2px 0 var(--rz-danger);
    }
  }

  .rz-document-title-error {
    color: var(--rz-danger);
    font-size: var(--rz-text-sm);
  }

  .rz-document-meta {
    font-size: var(--rz-text-sm);
  }
</style>
