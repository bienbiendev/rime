<script lang="ts">
  import { goto } from '$app/navigation';
  import { PARAMS } from '#lib/core/constants.js';
  import { canDuplicate } from '#lib/core/prototype/collection/can-duplicate.js';
  import { apiUrl, panelPath } from '#lib/core/routes/util.js';
  import * as Dialog from '#lib/panel/components/ui/dialog/index.js';
  import * as DropdownMenu from '#lib/panel/components/ui/dropdown-menu/index.js';
  import { getAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import { useCommands } from '#lib/panel/context/commands.svelte.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import { titleOrUntitled } from '#lib/panel/util/title.js';
  import type { GenericDoc } from '#lib/types.js';
  import { trycatchFetch } from '#lib/util/function.js';
  import Copy from '@lucide/svelte/icons/copy';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Hash from '@lucide/svelte/icons/hash';
  import Import from '@lucide/svelte/icons/import';
  import PencilRuler from '@lucide/svelte/icons/pencil-ruler';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';

  type Props = { form: DocumentFormContext<GenericDoc> };

  const { form }: Props = $props();

  let deleteConfirmOpen = $state(false);
  let dupplicateConfirmOpen = $state(false);
  const isCollection = $derived(form.config.type === 'collection');
  const allowDuplicate = $derived(canDuplicate(form.config));
  const locale = getLocaleContext();
  const APIProxy = getAPIProxyContext();

  /** The live editor, opened on the page at its url; a read-only form shows it greyed. */
  const live = $derived(form.config.live && form.values._live ? form.values._live : null);

  async function handleDuplicate() {
    if (Object.keys(form.changes).length) {
      dupplicateConfirmOpen = true;
    } else {
      duplicate();
    }
  }

  /** Deletes the document, then lists the collection; a request that fails shows an error. */
  async function handleDelete() {
    const [error] = await trycatchFetch(`${apiUrl(form.config.kebab)}/${form.values.id}`, {
      method: 'DELETE'
    });
    if (error) {
      toast.error(t__('common.generic_error'));
      return;
    }
    toast.success(t__('common.doc_deleted'));
    // The panel's cached reads of the collection drop the deleted document.
    APIProxy.invalidate(apiUrl(form.config.kebab));
    goto(panelPath(form.config.kebab));
  }

  /**
   * Copies the row on screen, an auto-saved one included, then opens the copy without the unsaved
   * changes.
   */
  async function duplicate() {
    const versionId = form.values.versionId;
    const url = `${apiUrl(form.config.kebab, form.values.id)}/duplicate${versionId ? `?${PARAMS.VERSION_ID}=${versionId}` : ''}`;
    const [error, success] = await trycatchFetch(url, { method: 'POST' });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { id } = await success.json();
    // The dialog warned about the unsaved changes: they go, so the navigation does not ask again.
    form.reset();
    toast.success(t__('common.duplicate_success'));
    // The panel's cached reads of the collection list the copy.
    APIProxy.invalidate(apiUrl(form.config.kebab));
    await goto(panelPath(form.config.kebab, id));
  }

  /** The document's id, on the clipboard. */
  async function copyId() {
    try {
      await navigator.clipboard.writeText(String(form.values.id));
      toast.success(t__('common.id_copied'));
    } catch {
      toast.error(t__('common.generic_error'));
    }
  }

  type Action = {
    id: string;
    label: string;
    icon: typeof Copy;
    run: () => unknown;
    /** A deletion: last, under a separator, in red. */
    danger?: boolean;
  };

  /** The document's actions, the deletion last: the menu's entries and the palette's lines. */
  const actions = $derived<Action[]>([
    ...(allowDuplicate
      ? [
          {
            id: 'document.duplicate',
            label: t__('common.duplicate'),
            icon: Copy,
            run: handleDuplicate
          }
        ]
      : []),
    {
      id: 'document.copy_id',
      label: t__('common.copy_id'),
      icon: Hash,
      run: copyId
    },
    ...(locale.defaultCode && locale.code !== locale.defaultCode
      ? [
          {
            id: 'document.import_locale',
            label: t__('common.import_default_locale', locale.defaultCode),
            icon: Import,
            run: () => form.importDataFromDefaultLocale()
          }
        ]
      : []),
    ...(isCollection
      ? [
          {
            id: 'document.delete',
            label: t__('common.delete_document'),
            icon: Trash2,
            danger: true,
            run: () => (deleteConfirmOpen = true)
          }
        ]
      : [])
  ]);

  useCommands(() =>
    actions.map(({ id, label, icon, run }) => ({
      id,
      label,
      icon,
      run,
      group: t__('common.document')
    }))
  );
</script>

<!--
  A ghost "⋯" after the document's title: the live editor first, then the document's actions,
  the deletion last and in red.
-->
<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        icon={Ellipsis}
        size="icon-sm"
        variant="ghost"
        aria-label={t__('common.document_actions')}
        {...props}
        class="{props.class} rz-document-menu__trigger"
      />
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content align="start" sideOffset={6} class="rz-document-menu">
      {#if live}
        <DropdownMenu.Item disabled={form.readOnly}>
          {#snippet child({ props })}
            <a
              {...props}
              class="{props.class} rz-document-menu__live"
              href={form.readOnly ? undefined : live}
            >
              <PencilRuler size="14" />
              {t__('common.live_edit')}
            </a>
          {/snippet}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
      {/if}
      {#each actions as action, index (action.id)}
        {@const Icon = action.icon}
        {#if action.danger && !actions[index - 1]?.danger}
          <DropdownMenu.Separator />
        {/if}
        <DropdownMenu.Item
          class={action.danger ? 'rz-document-menu__danger' : undefined}
          onclick={action.run}
        >
          <Icon size="14" />
          {action.label}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<Dialog.Root bind:open={deleteConfirmOpen}>
  <Dialog.Content>
    <Dialog.Header>
      {t__('common.delete_dialog_title', titleOrUntitled(form.title))}
    </Dialog.Header>
    <p>{t__('common.delete_dialog_text', titleOrUntitled(form.title))}</p>
    <Dialog.Footer>
      <Button onclick={handleDelete} kbd="enter">{t__('common.delete_confirm')}</Button>
      <Button onclick={() => (deleteConfirmOpen = false)} variant="secondary" kbd="escape">
        {t__('common.cancel')}
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
    <Dialog.Footer>
      <Button onclick={duplicate} kbd="enter">{t__('common.duplicate')}</Button>
      <Button onclick={() => (dupplicateConfirmOpen = false)} variant="secondary" kbd="escape">
        {t__('common.cancel')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  /* The "⋯" in the heading's ink, quieter until hovered or open. */
  :global(.rz-document-menu__trigger) {
    color: var(--rz-fg-subtle);
  }

  :global(.rz-document-menu__trigger:is(:hover, [data-state='open'])) {
    color: var(--rz-fg);
  }

  /* A floating card of 28px rows, each with a subtle icon; a deletion in red. */
  :global(.rz-document-menu.rz-dropdown-content) {
    min-width: var(--rz-size-52);
    padding: var(--rz-size-1);
    border-radius: var(--rz-radius-xl);
  }

  :global(.rz-document-menu .rz-dropdown-item) {
    gap: var(--rz-size-2);
    height: var(--rz-size-7);
    padding-block: 0;
    padding-inline: var(--rz-size-2);
    white-space: nowrap;
  }

  :global(.rz-document-menu .rz-dropdown-item svg) {
    flex-shrink: 0;
    color: var(--rz-fg-subtle);
  }

  :global(.rz-document-menu .rz-dropdown-item[data-highlighted]) {
    background-color: var(--rz-bg-hover);
  }

  :global(.rz-document-menu .rz-document-menu__danger),
  :global(.rz-document-menu .rz-document-menu__danger svg) {
    color: var(--rz-danger);
  }

  :global(.rz-document-menu .rz-dropdown-separator) {
    margin-inline: --size(-1);
  }
</style>
