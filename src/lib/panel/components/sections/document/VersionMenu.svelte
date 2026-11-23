<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PARAMS } from '#lib/core/constants.js';
  import { t__ } from '#lib/core/i18n/index.js';
  import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
  import { apiUrl, panelPath } from '#lib/core/routes/util.js';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import * as DropdownMenu from '#lib/panel/components/ui/dropdown-menu/index.js';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import { useCommands } from '#lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import { getUserContext } from '#lib/panel/context/user.svelte.js';
  import { getVersionsContext } from '#lib/panel/context/versions.svelte.js';
  import type { DocVersion } from '#lib/panel/index.js';
  import { documentSegments } from '#lib/panel/util/url.js';
  import type { GenericDoc } from '#lib/types.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import FilePlus from '@lucide/svelte/icons/file-plus';
  import History from '@lucide/svelte/icons/history';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { toast } from 'svelte-sonner';
  import Button from '../../ui/button/button.svelte';
  import StatusDot from '../collection/StatusDot.svelte';
  import { setVersionStatus } from './version-status.js';
  import { versionsApiUrl, versionsListUrl } from './versions-list.js';

  type Props = { form: DocumentFormContext<GenericDoc> };
  const { form }: Props = $props();

  const APIProxy = getAPIProxyContext();
  const locale = getLocaleContext();
  const user = getUserContext();
  /** The history lives on the document page; `undefined` where a document is shown without one. */
  const history = getVersionsContext();

  const drafts = $derived(!!form.config.versions?.draft);
  const published = $derived(form.values.status === VERSIONS_STATUS.PUBLISHED);

  const resource = $derived(
    APIProxy.getRessource<{ docs: DocVersion[] }>(versionsListUrl(form.values))
  );
  const list = $derived(resource.data?.docs ?? []);
  /** The newest rows; "All versions" opens the whole history. */
  const recent = $derived(list.slice(0, 3));
  /** A document keeps at least one version, so its last one cannot be deleted. */
  const canDeleteVersion = $derived(list.length > 1);

  /** The row the site shows: the newest published one with drafts, else the newest. */
  const live = $derived(
    list.find(
      (version) => !version.isAutoSave && (!drafts || version.status === VERSIONS_STATUS.PUBLISHED)
    )
  );

  /**
   * The row on screen at its url, when the site shows another one:
   * `https://site.com/news/hello?versionId=v2`.
   */
  const preview = $derived.by(() => {
    const url = form.values.url;
    if (!url || !form.values.versionId || live?.id === form.values.versionId) return null;
    const href = new URL(url);
    href.searchParams.set(PARAMS.VERSION_ID, String(form.values.versionId));
    return href.href;
  });

  const documentPath = $derived(panelPath(...documentSegments(form.config.kebab, form.values)));
  const versionPath = (versionId: string) => `${documentPath}?${PARAMS.VERSION_ID}=${versionId}`;

  const who = (version: DocVersion) =>
    version.updatedBy?.name || version.updatedBy?.email || t__('common.someone');
  const when = (version: DocVersion) =>
    locale.dateFormat(version.updatedAt, { short: true, withTime: true });

  /**
   * A row's two sides: an auto-save by whose typing it is, a version by its status with drafts,
   * else by its date.
   *
   * ```
   * Your auto-save      19 Nov 14:02
   * Draft               Admin · 19 Nov 14:02
   * 19 Nov 14:02        Admin
   * ```
   */
  function describe(version: DocVersion) {
    if (version.isAutoSave) {
      const label =
        version.updatedBy?.id === user.attributes.id
          ? t__('common.your_auto_save')
          : t__('common.auto_save_by', who(version));
      return { label, meta: when(version) };
    }
    if (drafts) {
      return { label: t__(`common.${version.status}`), meta: `${who(version)} · ${when(version)}` };
    }
    return { label: when(version), meta: who(version) };
  }

  let deleteConfirmOpen = $state(false);

  /** One version goes; the document and its other versions stay. */
  async function deleteVersion() {
    const response = await fetch(`${versionsApiUrl(form.config.slug)}/${form.values.versionId}`, {
      method: 'DELETE'
    });
    deleteConfirmOpen = false;
    if (!response.ok) {
      toast.error(t__('common.generic_error'));
      return;
    }
    toast.success(t__('common.version_deleted'));
    // The version history drops the deleted row. `apiUrl(kebab)` reaches `/api/<kebab>--versions`
    // because `invalidate` matches by substring (api-proxy.svelte.ts).
    APIProxy.invalidate(apiUrl(form.config.kebab));
    // The plain address may be the one loaded: the loads rerun so the page lands on the newest row,
    // and the form, which was on the deleted row, is rebuilt on it.
    await goto(documentPath, { refreshAll: true });
    history?.rebuildForm();
  }

  /** Sets a `data-*` attribute, or removes it when the value is `undefined`. */
  function setData(element: HTMLElement, key: string, value: string | undefined) {
    if (value === undefined) {
      delete element.dataset[key];
    } else {
      element.dataset[key] = value;
    }
  }

  /**
   * Submits through the Save button as a new draft, then gives the button its own attributes back.
   * The submit listener reads them before its first `await`, so they are back once it has.
   */
  function saveAsNewDraft() {
    if (form.readOnly || !form.element) return;
    const saveButton = form.element.querySelector<HTMLButtonElement>('button[data-submit]');
    if (!saveButton) return;

    const { fork, status } = saveButton.dataset;
    setData(saveButton, 'fork', 'true');
    setData(saveButton, 'status', VERSIONS_STATUS.DRAFT);
    form.element.requestSubmit(saveButton);
    setData(saveButton, 'fork', fork);
    setData(saveButton, 'status', status);
  }

  const openHistory = () => {
    if (history) history.open = true;
  };

  /** The version actions in the palette: the history, a new draft, the other status, a deletion. */
  useCommands(() => [
    ...(history
      ? [
          {
            id: 'document.versions',
            label: t__('common.versions_history'),
            icon: History,
            group: t__('common.document'),
            run: openHistory
          }
        ]
      : []),
    ...(drafts && published
      ? [
          {
            id: 'document.new_draft',
            label: t__('common.save_new_draft'),
            icon: FilePlus,
            group: t__('common.document'),
            run: saveAsNewDraft
          }
        ]
      : []),
    ...(drafts
      ? Object.values(VERSIONS_STATUS)
          .filter((status) => status !== form.values.status)
          .map((status) => ({
            id: `document.status.${status}`,
            label: t__('common.mark_as', t__(`common.${status}`)),
            group: t__('common.document'),
            run: () => setVersionStatus(form, APIProxy, status)
          }))
      : []),
    ...(form.values.versionId && canDeleteVersion
      ? [
          {
            id: 'document.delete_version',
            label: t__('common.delete_version'),
            icon: Trash2,
            group: t__('common.document'),
            run: () => (deleteConfirmOpen = true)
          }
        ]
      : [])
  ]);
</script>

<!--
  The row on screen and its history: with drafts its status, else "History". Opens on a preview of
  the row when the site shows another, the newest versions, then what can be done with the row.
-->
<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button size="sm" variant="ghost" {...props} class="{props.class} rz-version-menu__trigger">
        {#if drafts}
          <StatusDot status={form.values.status} />
          <span class="rz-version-menu__status">{t__(`common.${form.values.status}`)}</span>
        {:else}
          <History size="14" />
          {t__('common.history')}
        {/if}
        <ChevronDown size="14" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content align="end" sideOffset={6} class="rz-document-menu rz-version-menu">
      {#if preview}
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a {...props} href={preview} target="_blank" rel="noreferrer">
              <Eye size="14" />
              <span class="rz-version-menu__grow">
                {published ? t__('common.preview_version') : t__('common.preview_draft')}
              </span>
              <ExternalLink size="14" />
            </a>
          {/snippet}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
      {/if}

      <div class="rz-version-menu__heading">
        <span>{t__('common.versions')}</span>
        {#if history}
          <DropdownMenu.Item class="rz-version-menu__all" onclick={openHistory}>
            {t__('common.all_versions')}
          </DropdownMenu.Item>
        {/if}
      </div>

      {#each recent as version (version.id)}
        {@const { label, meta } = describe(version)}
        <DropdownMenu.Item>
          {#snippet child({ props })}
            <a
              {...props}
              href={resolve(versionPath(version.id))}
              class="{props.class} rz-version-menu__row"
              aria-current={version.id === form.values.versionId ? 'true' : undefined}
            >
              {#if drafts && !version.isAutoSave}
                <StatusDot status={version.status} />
              {/if}
              <span class="rz-version-menu__grow">{label}</span>
              {#if version.id === live?.id}
                <span class="rz-version-menu__live">{t__('common.live')}</span>
              {/if}
              <span class="rz-version-menu__meta">{meta}</span>
            </a>
          {/snippet}
        </DropdownMenu.Item>
      {/each}

      {#if drafts && !published && live}
        <p class="rz-version-menu__note">
          {t__('common.publish_replaces', locale.dateFormat(live.updatedAt, { short: true }))}
        </p>
      {/if}

      {#if drafts && published}
        <DropdownMenu.Separator />
        <DropdownMenu.Item disabled={form.readOnly} onclick={saveAsNewDraft}>
          <FilePlus size="14" />
          {t__('common.save_new_draft')}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={form.readOnly}
          onclick={() => setVersionStatus(form, APIProxy, VERSIONS_STATUS.DRAFT)}
        >
          <EyeOff size="14" />
          {t__('common.unpublish')}
        </DropdownMenu.Item>
      {/if}

      {#if form.values.versionId}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          class="rz-document-menu__danger"
          disabled={!canDeleteVersion || form.readOnly}
          onclick={() => (deleteConfirmOpen = true)}
        >
          <Trash2 size="14" />
          {drafts && !published ? t__('common.delete_draft') : t__('common.delete_version')}
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      {t__('common.delete_version_dialog_title')}
    </Dialog.Header>
    <p>{t__('common.delete_version_dialog_text')}</p>
    <Dialog.Footer>
      <Button onclick={deleteVersion} kbd="enter">{t__('common.delete_confirm')}</Button>
      <Button onclick={() => (deleteConfirmOpen = false)} variant="secondary" kbd="escape">
        {t__('common.cancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  /* The status as a ghost button: a small dot, its name, then a chevron. */
  :global(.rz-version-menu__trigger) {
    --rz-dot-size: var(--rz-size-1-5);
  }

  /* The document menu's card, wider: a row holds a name, a "Live" mark and who saved it, when. */
  :global(.rz-version-menu.rz-dropdown-content) {
    --rz-dot-size: var(--rz-size-1-5);
    width: var(--rz-size-80);
  }

  :global(.rz-version-menu .rz-version-menu__grow) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* "Versions", then "All versions" as a link at the end of the line. */
  .rz-version-menu__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--rz-size-1) var(--rz-size-1) var(--rz-size-1) var(--rz-size-2);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-xs);
  }

  :global(.rz-version-menu .rz-dropdown-item.rz-version-menu__all) {
    height: var(--rz-size-6);
    padding-inline: var(--rz-size-1-5);
    color: var(--rz-accent-text);
    font-size: var(--rz-text-xs);
  }

  :global(.rz-version-menu .rz-version-menu__row[aria-current='true']) {
    background-color: var(--rz-bg-active);
  }

  .rz-version-menu__live {
    padding: 0 var(--rz-size-1-5);
    border-radius: var(--rz-radius-sm);
    background-color: color-mix(in oklch, var(--rz-success) 14%, transparent);
    color: var(--rz-success);
    font-size: var(--rz-text-xs);
  }

  .rz-version-menu__meta {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
    font-variant-numeric: tabular-nums;
  }

  .rz-version-menu__note {
    padding: var(--rz-size-1) var(--rz-size-2);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-xs);
  }
</style>
