<script lang="ts">
  import { goto } from '$app/navigation';
  import { PARAMS } from '$lib/core/constants.js';
  import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getVersionsContext } from '$lib/panel/context/versions.svelte.js';
  import type { GenericDoc } from '$lib/types.js';
  import { trycatchFetch } from '$lib/util/function.js';
  import { Copy, History, Import, Pickaxe, Settings, Trash2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';
  import { versionsApiUrl, versionsListUrl } from './versions-list.js';

  type Props = { form: DocumentFormContext<GenericDoc> };

  const { form }: Props = $props();

  let deleteConfirmOpen = $state(false);
  let deleteVersionConfirmOpen = $state(false);
  let dupplicateConfirmOpen = $state(false);
  const isCollection = $derived(form.config.type === 'collection');
  const allowDuplicate = $derived(
    form.config.type === 'collection' && !form.config.auth && !form.config.upload
  );
  const locale = getLocaleContext();
  const APIProxy = getAPIProxyContext();

  const documentPath = $derived(
    isCollection ? panelPath(form.config.kebab, form.values.id) : panelPath(form.config.kebab)
  );

  /**
   * How many versions the document has, off the same list the history shows. A document keeps at
   * least one, so its last version cannot be deleted.
   */
  const versionsResource = $derived(
    form.config.versions && form.values.id
      ? APIProxy.getRessource<{ docs: unknown[] }>(versionsListUrl(form.values))
      : null
  );
  const canDeleteVersion = $derived((versionsResource?.data?.docs.length ?? 0) > 1);

  /** One version goes; the document and its other versions stay. */
  async function handleDeleteVersion() {
    const response = await fetch(`${versionsApiUrl(form.config.slug)}/${form.values.versionId}`, {
      method: 'DELETE'
    });
    deleteVersionConfirmOpen = false;
    if (!response.ok) {
      toast.error(t__('error.generic'));
      return;
    }
    toast.success(t__('common.version_deleted'));
    APIProxy.invalidate(form.config.slug);
    await goto(documentPath);
  }

  function handleNewDraft() {
    if (form.readOnly || !form.element) return;
    const saveButton = form.element.querySelector('button[data-submit]') as HTMLButtonElement;
    const initialFork = saveButton.dataset.fork;
    if (saveButton) {
      saveButton.dataset.fork = 'true';
      saveButton.dataset.status = VERSIONS_STATUS.DRAFT;
      form.element.requestSubmit(saveButton as HTMLButtonElement);
    } else {
      // Fallback to default submit if no specific button found
      form.element.requestSubmit();
    }
    saveButton.dataset.fork = initialFork;
  }

  /** The history lives on the document page; `undefined` where a document is shown without one. */
  const history = getVersionsContext();

  async function handleDuplicate() {
    if (Object.keys(form.changes).length) {
      dupplicateConfirmOpen = true;
    } else {
      duplicate();
    }
  }

  async function handleDelete() {
    await fetch(`${apiUrl(form.config.kebab)}/${form.values.id}`, {
      method: 'DELETE'
    }).then((response) => {
      if (response.ok) {
        toast.success(t__('common.doc_deleted'));
        goto(panelPath(form.config.kebab));
      } else {
        toast.error(t__('error.generic'));
      }
    });
  }

  /** Copies the row on screen, an auto-saved one included. */
  async function duplicate() {
    form.reset();
    const versionId = form.values.versionId;
    const url = `${apiUrl(form.config.kebab, form.values.id)}/duplicate${versionId ? `?${PARAMS.VERSION_ID}=${versionId}` : ''}`;

    const [error, success] = await trycatchFetch(url, {
      method: 'POST'
    });

    if (error) {
      toast.error(error.message);
      return console.log(error);
    }
    const { id } = await success.json();
    toast.success(t__('common.duplicate_success'));
    await goto(panelPath(form.config.kebab, id));
  }

  /** The menu's entries, in the palette as well. */
  useCommands(() => {
    const group = t__('common.document');
    return [
      ...(form.config.versions && history
        ? [
            {
              id: 'document.versions',
              label: t__('common.versions_history'),
              group,
              icon: History,
              run: () => (history.open = true)
            }
          ]
        : []),
      ...(form.config.versions?.draft && form.values.status === VERSIONS_STATUS.PUBLISHED
        ? [
            {
              id: 'document.new_draft',
              label: t__('common.save_new_draft'),
              group,
              icon: Pickaxe,
              run: handleNewDraft
            }
          ]
        : []),
      ...(allowDuplicate
        ? [
            {
              id: 'document.duplicate',
              label: t__('common.duplicate'),
              group,
              icon: Copy,
              run: handleDuplicate
            }
          ]
        : []),
      ...(locale.defaultCode && locale.code !== locale.defaultCode
        ? [
            {
              id: 'document.import_locale',
              label: t__('common.import_default_locale', locale.defaultCode),
              group,
              icon: Import,
              run: () => form.importDataFromDefaultLocale()
            }
          ]
        : []),
      ...(form.config.versions && form.values.versionId
        ? [
            {
              id: 'document.delete_version',
              label: t__('common.delete_version'),
              group,
              icon: Trash2,
              when: () => canDeleteVersion,
              run: () => (deleteVersionConfirmOpen = true)
            }
          ]
        : []),
      ...(isCollection
        ? [
            {
              id: 'document.delete',
              label: t__('common.delete_document'),
              group,
              icon: Trash2,
              run: () => (deleteConfirmOpen = true)
            }
          ]
        : [])
    ];
  });

  const shouldShowSettings = $derived.by(() => {
    if (form.config.versions) return true;
    if (locale.defaultCode && locale.code !== locale.defaultCode) return true;
    if (form.config.type === 'collection') return true;
  });
</script>

{#if shouldShowSettings}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button icon={Settings} size="icon-sm" variant="secondary" {...props} />
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end">
        {#if form.config.versions && history}
          <DropdownMenu.Item onclick={() => (history.open = true)}>
            <History size="12" />
            {t__('common.versions_history')}
          </DropdownMenu.Item>
        {/if}

        {#if form.config.versions && form.config.versions.draft && form.values.status === VERSIONS_STATUS.PUBLISHED}
          <DropdownMenu.Item onclick={() => handleNewDraft()}>
            <Pickaxe size="12" />
            {t__('common.save_new_draft')}
          </DropdownMenu.Item>
        {/if}

        {#if form.config.type === 'collection'}
          {#if allowDuplicate}
            <DropdownMenu.Item onclick={handleDuplicate}>
              <Copy size="12" />
              {t__('common.duplicate')}
            </DropdownMenu.Item>
          {/if}
        {/if}

        {#if locale.defaultCode && locale.code !== locale.defaultCode}
          <DropdownMenu.Item onclick={() => form.importDataFromDefaultLocale()}>
            <Import size="12" />
            {t__('common.import_default_locale', locale.defaultCode)}
          </DropdownMenu.Item>
        {/if}

        {#if form.config.versions && form.values.versionId}
          <DropdownMenu.Item
            disabled={!canDeleteVersion}
            onclick={() => (deleteVersionConfirmOpen = true)}
          >
            <Trash2 size="12" />
            {t__('common.delete_version')}
          </DropdownMenu.Item>
        {/if}

        {#if form.config.type === 'collection'}
          <DropdownMenu.Item onclick={() => (deleteConfirmOpen = true)}>
            <Trash2 size="12" />
            {t__('common.delete_document')}
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>

  <Dialog.Root bind:open={deleteConfirmOpen}>
    <Dialog.Content>
      <Dialog.Header>
        {t__('common.delete_dialog_title')}
      </Dialog.Header>
      <p>{t__('common.delete_dialog_text')}</p>
      <Dialog.Footer --rz-justify-content="space-between">
        <Button onclick={handleDelete}>Delete</Button>
        <Button onclick={() => (deleteConfirmOpen = false)} variant="secondary">Cancel</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <Dialog.Root bind:open={deleteVersionConfirmOpen}>
    <Dialog.Content>
      <Dialog.Header>
        {t__('common.delete_version_dialog_title')}
      </Dialog.Header>
      <p>{t__('common.delete_version_dialog_text')}</p>
      <Dialog.Footer --rz-justify-content="space-between">
        <Button onclick={handleDeleteVersion}>Delete</Button>
        <Button onclick={() => (deleteVersionConfirmOpen = false)} variant="secondary">
          Cancel
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  <Dialog.Root bind:open={dupplicateConfirmOpen}>
    <Dialog.Content>
      <Dialog.Header>
        {t__('common.unsaved_dialog_title')}
      </Dialog.Header>
      <p>{t__('common.unsaved_dialog_text')}</p>
      <Dialog.Footer --rz-justify-content="space-between">
        <Button onclick={duplicate}>Duplicate</Button>
        <Button onclick={() => (dupplicateConfirmOpen = false)} variant="secondary">Cancel</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
