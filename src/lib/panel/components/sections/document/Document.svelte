<script lang="ts">
  import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import type { ResolvedPathname } from '$app/types';
  import { isAuthConfig } from '$lib/core/auth/util';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { openSse } from '$lib/core/plugins/sse/index.js';
  import { isUploadConfig } from '$lib/core/prototype/collection/upload/util/config';
  import { EDIT_LOCK_TTL_MS } from '$lib/core/prototype/shared/metas/constant.js';
  import { isLockHeldByOther } from '$lib/core/prototype/shared/metas/lock.js';
  import type { GenericDoc } from '$lib/core/prototype/types';
  import { apiUrl } from '$lib/core/routes/util.js';
  import BlocksFocus from '$lib/fields/blocks/component/focus/BlocksFocus.svelte';
  import { setBlocksFocusContext } from '$lib/fields/blocks/component/focus/focus.svelte.js';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import {
    setDocumentFormContext,
    type FormSuccessData
  } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { getVersionsContext } from '$lib/panel/context/versions.svelte.js';
  import { Save } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import RenderFields from '../../fields/RenderFields.svelte';
  import Button from '../../ui/button/button.svelte';
  import AuthApiKeyDialog from './AuthAPIKeyDialog.svelte';
  import AuthFooter from './AuthFooter.svelte';
  import AutoSaveBanner from './AutoSaveBanner.svelte';
  import CurrentlyEdited from './CurrentlyEdited.svelte';
  import Header from './Header.svelte';
  import UploadHeader from './upload-header/UploadHeader.svelte';

  type Props = {
    doc: GenericDoc;
    operation: 'update' | 'create';
    class?: string;
    onFieldFocus?: any;
    readOnly: boolean;
    onClose?: any;
    nestedLevel?: number;
    onNestedDocumentCreated?: any;
  };

  const {
    doc: initial,
    operation,
    readOnly,
    onClose,
    onNestedDocumentCreated,
    nestedLevel = 0,
    onFieldFocus = null,
    class: className
  }: Props = $props();

  const { getDocumentConfig } = getConfigContext();

  const user = getUserContext();
  const config = $derived(
    getDocumentConfig({
      prototype: initial._prototype,
      slug: initial._type
    })
  );

  let formElement = $state<HTMLFormElement>();
  // A leave held back by unsaved changes: what to do once the user confirms. A navigation goes
  // on to its URL; a locale switch reloads in place.
  let interceptedLeave = $state<{ proceed: () => unknown } | null>(null);
  // This is used to prevent the beforeNavigate from triggering when we programmatically navigate
  let isRedirect = $state(false);
  // Dialog for unsaved changes confirmation
  const isConfirmLeaveOpen = $derived(!!interceptedLeave);
  const locale = getLocaleContext();

  // This is used to show the API key after creating a document in a collection with API key auth
  let apiKey = $state<string | null>('');

  /**
   * Intercept navigation when there are unsaved changes in the form.
   *
   * With auto-save on, what is pending is written first and the navigation goes through; the
   * dialog only appears if that write fails. A closing tab gets no chance to await anything, so
   * its pending changes go by beacon from the `pagehide` handler below instead.
   */
  beforeNavigate(async ({ cancel, to, willUnload }) => {
    // Leaving the document releases it, whether or not the form is dirty — the confirm dialog
    // below can still cancel the navigation, and the next beat re-claims it.
    if (!readOnly && operation === 'update') editLock('release');

    const hasCHanges = Object.keys(form.changes).length > 0;
    if (!hasCHanges) return;
    if (isRedirect) return;
    if (interceptedLeave) return;
    if (!to) return;
    if (willUnload && form.isAutoSave) return;
    cancel();

    if (form.isAutoSave) {
      const landed = await form.flushAutoSave();
      if (landed) {
        isRedirect = true;
        goto(to.url.href as ResolvedPathname);
        return;
      }
    }

    interceptedLeave = { proceed: () => goto(to.url.href as ResolvedPathname) };
  });

  function confirmLeave() {
    interceptedLeave?.proceed();
  }

  /**
   * The language switcher reloads the page in place rather than navigating, so `beforeNavigate`
   * never sees it. The same rules run from here: pending changes are auto-saved first when the
   * config auto-saves, and asked about otherwise.
   */
  async function switchLocale() {
    const hasChanges = Object.keys(form.changes).length > 0;
    if (!hasChanges) return invalidateAll();
    if (form.isAutoSave && (await form.flushAutoSave())) return invalidateAll();
    interceptedLeave = { proceed: () => invalidateAll() };
  }

  // svelte-ignore state_referenced_locally
  const form = setDocumentFormContext({
    initial,
    config,
    readOnly,
    onNestedDocumentCreated,
    onFieldFocus,
    key: `${initial._type}_${nestedLevel}`,
    beforeRedirect: beforeRedirect
  });

  /** The blocks focus mode, on the document itself: a nested create has none. */
  const focus = nestedLevel === 0 ? setBlocksFocusContext(form) : null;

  /**
   * Somebody else has this document open, recently enough to still mean it.
   *
   * Read off `initial`, which the reload below refreshes — `form.values` is seeded from it once
   * and then belongs to whoever is typing.
   *
   * A claim carrying no timestamp cannot be aged, and counts as expired. The same test runs
   * server-side in `isLockHeldByOther`, which is where the claim is actually refused.
   */
  const isLockedByOther = $derived(isLockHeldByOther(initial, user.attributes.id));

  /** The version history marks the row the form is on, which an auto-save moves without a load. */
  const history = getVersionsContext();
  $effect(() => {
    if (history && nestedLevel === 0) history.versionId = form.values.versionId;
  });

  /**
   * Reload when this document's lock changes hands.
   *
   * The lock and the content move together: whoever was holding it was editing, and by the time
   * they hand it back the document on screen is a version behind. Taking the claim and the fresh
   * content in one reload is what stops the next editor saving over the last one's work.
   *
   * The page keys this component on `id + versionId + locale`, so a reload that brings a new
   * version remounts the form rather than leaving stale values in it.
   *
   * `lockKey` is a string so this re-runs only when it names a different document — `config` and
   * `initial` are both new objects after every load, and depending on them would drop the
   * connection and rebuild it each time, losing whatever was sent in between.
   */
  const lockKey = $derived(`rime:${config.slug}:${initial.id}`);

  $effect(() => {
    if (operation === 'create') return;

    return openSse(lockKey, ({ event }) => {
      if (event === 'rime:lock') invalidateAll();
    });
  });

  /** Nobody saves through the overlay: `canSubmit` is what the save buttons and ctrl-s read. */
  $effect(() => {
    form.isDisabled = isLockedByOther;
  });

  /**
   * This document's lock: POST takes it (claim), DELETE gives it back (release).
   *
   * A REST route, not a panel form action. Form actions live in the generated `+page.server.ts`
   * and each one has to be listed there by name. A `?/lock` action left off that list answers
   * 404, the claims fail quietly, and nothing but the TTL ever frees a document. A route declared
   * in the prototype's `rest` is written by codegen and cannot be left out.
   *
   * The claim names the row the form is on: an auto-save moves the form onto a new row without
   * a load, and the lock moves with it. `lockVersionId` is a string, so the claim effect below
   * re-runs when the row changes and not on every keystroke.
   */
  const lockVersionId = $derived(form.values.versionId as string | undefined);

  const lockUrl = (params: Record<string, string> = {}, versionId = lockVersionId) => {
    const base =
      initial._prototype === 'collection'
        ? `${apiUrl(config.kebab, initial.id)}/lock`
        : `${apiUrl(config.kebab)}/lock`;
    const search = new URLSearchParams({
      ...(versionId ? { [PARAMS.VERSION_ID]: versionId } : {}),
      ...params
    }).toString();
    return search ? `${base}?${search}` : base;
  };

  /**
   * Claim or release, the row the form is on unless another is named.
   *
   * The failure is logged rather than swallowed: a lock that silently does nothing looks exactly
   * like one that works and then ages out.
   */
  async function editLock(
    intent: 'claim' | 'release',
    options: { force?: boolean; versionId?: string } = {}
  ) {
    try {
      const response = await fetch(
        lockUrl(options.force ? { force: 'true' } : {}, options.versionId ?? lockVersionId),
        { method: intent === 'claim' ? 'POST' : 'DELETE' }
      );
      if (!response.ok) console.error(`edit lock: ${intent} answered ${response.status}`);
    } catch (error) {
      console.error(`edit lock: ${intent} failed`, error);
    }
  }

  /**
   * Hold the document for as long as it is open.
   *
   * Claimed on mount and renewed at half the TTL. The load does not claim: opening a document is
   * a read, and a read that writes is a read that has to explain itself in every caller. Here it
   * is one effect — take it when the editor arrives, keep it while they stay, and the renewal is
   * the same call as the claim. Half the TTL leaves room for one missed beat.
   *
   * Not while the document is read-only, being created (there is no row to lock yet), or already
   * held by somebody else.
   *
   * When an auto-save or a fork moves the form onto a new row, the server has already carried the
   * claim onto it (`moveEditLock`): the renewal reads the row the form is on when it fires, and
   * this runs once per mount. The release on leaving is `beforeNavigate`'s or `pagehide`'s.
   */
  $effect(() => {
    if (readOnly || operation === 'create' || isLockedByOther) return;

    untrack(() => editLock('claim'));
    const interval = setInterval(() => editLock('claim'), EDIT_LOCK_TTL_MS / 2);
    return () => clearInterval(interval);
  });

  /**
   * Hand the document back when the tab goes away.
   *
   * `pagehide` rather than `beforeunload`, and `sendBeacon` rather than `fetch`: a close is the
   * one exit that gets no chance to await anything, and a beacon is handed to the browser to
   * deliver after the page is gone. A beacon can only POST, so the release it sends carries the
   * intent in the query rather than in the method. A release that does not make it is not a
   * failure — the claim ages out instead, just more slowly.
   */
  $effect(() => {
    if (readOnly || operation === 'create') return;

    const release = () => {
      form.beaconAutoSave();
      navigator.sendBeacon(lockUrl({ release: 'true' }));
    };

    window.addEventListener('pagehide', release);
    return () => window.removeEventListener('pagehide', release);
  });

  /** ⌘S from anywhere in the document, a field included. */
  useCommands(() => [
    {
      id: 'document.save',
      label: t__('common.save'),
      group: t__('common.document'),
      icon: Save,
      keys: 'mod+s',
      inField: true,
      run: submit
    }
  ]);

  function submit() {
    if (!formElement) throw Error('formElement is not defined');
    if (!form.canSubmit) return;
    const saveButton = formElement.querySelector('button[data-submit]');
    if (saveButton) formElement.requestSubmit(saveButton as HTMLButtonElement);
    else formElement.requestSubmit();
  }

  async function beforeRedirect(data?: FormSuccessData) {
    const IS_API_AUTH = config.type === 'collection' && config.auth?.type === 'apiKey';
    if (IS_API_AUTH) {
      apiKey = data?.document?.apiKey || null;
      return new Promise<boolean>((resolve) => {
        function checkAndResolve() {
          if (!apiKey) {
            isRedirect = !!data?.redirectUrl;
            resolve(true);
            clearInterval(intervalId);
          }
        }
        const intervalId = setInterval(checkAndResolve, 100);
      });
    }
    isRedirect = !!data?.redirectUrl;
    return true;
  }
</script>

{#snippet meta(label: string, value: string)}
  <p class="rz-document__metas">
    <span>{label} : </span>
    {value}
  </p>
{/snippet}

{#snippet metaUser(label: string, name: string)}
  <p class="rz-document__metas">
    <span>{label} : </span>
    {name || '—'}
  </p>
{/snippet}

<form
  class="rz-document {className}"
  data-nested={nestedLevel > 0 ? '' : undefined}
  bind:this={formElement}
  use:form.enhance
  enctype="multipart/form-data"
  method="post"
>
  <Header {form} {config} {onClose} onLocaleSwitch={switchLocale}></Header>

  {#if isLockedByOther}
    <CurrentlyEdited
      holder={initial.currentlyEditedBy}
      takeControl={() => editLock('claim', { force: true }).then(() => window.location.reload())}
    />
  {/if}

  <div class="rz-document__fields">
    {#if config.type === 'collection' && isUploadConfig(config)}
      <UploadHeader accept={config.upload.accept} create={operation === 'create'} {form} />
    {/if}
    {#if focus?.path}
      <BlocksFocus {form} />
    {:else}
      <RenderFields fields={config.fields} {form} />
    {/if}
    <!--  -->
    {#if config.type === 'collection' && isAuthConfig(config) && config.auth.type === 'password'}
      <AuthFooter collection={config} {operation} {form} />
    {/if}
  </div>

  <div class="rz-document__infos">
    {#if form.values.createdAt}
      {@render meta(t__('common.created_at'), locale.dateFormat(form.values.createdAt))}
    {/if}
    {#if form.values.createdBy}
      {@render metaUser(t__('common.created_by'), form.values.createdBy?.name)}
    {/if}
    {#if form.values.updatedAt}
      {@render meta(t__('common.last_update'), locale.dateFormat(form.values.updatedAt))}
    {/if}
    {#if form.values.updatedBy}
      {@render metaUser(t__('common.updated_by'), form.values.updatedBy?.name)}
    {/if}
    {#if form.values.id}
      {@render meta('id', form.values.id)}
    {/if}
  </div>

  <!-- Last in the flow, so its sticky bottom holds it at the viewport's edge until the end. -->
  {#if nestedLevel === 0 && operation === 'update' && page.data.autoSaves}
    <AutoSaveBanner autoSaves={page.data.autoSaves} {form} />
  {/if}

  <!-- This shows the create API Key after creation, for apiKey auth type collection -->
  {#if apiKey}
    <AuthApiKeyDialog bind:apiKey />
  {/if}

  <Dialog.Root
    open={isConfirmLeaveOpen}
    onOpenChange={(open) => {
      if (!open) {
        interceptedLeave = null;
      }
    }}
  >
    <Dialog.Content>
      <Dialog.Header>
        {t__('common.leave_confirm_title')}
      </Dialog.Header>
      <p>{t__('common.leave_confirm_text')}</p>
      <!--  -->
      <Dialog.Footer --rz-justify-content="space-between">
        <Button onclick={confirmLeave}>
          {t__('common.confirm')}
        </Button>
        <Button onclick={() => (interceptedLeave = null)} variant="secondary">
          {t__('common.cancel')}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</form>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-document {
    container: rz-document / inline-size;
    position: relative;
    display: flex;
    flex-direction: column;
    background-image: var(--thumbnail);
    background-size: cover;
  }

  /* A page of its own is at least the window's height, so the metas sit at its bottom. */
  .rz-document:not([data-nested]) {
    min-height: 100svh;
  }

  /**
   * The editor stops growing and centres itself; the gutter is the floor.
   *
   *   --rz-document-width: 60rem
   */
  .rz-document__fields,
  .rz-document__infos {
    padding-inline: max(var(--rz-page-gutter), calc((100% - var(--rz-document-width, 60rem)) / 2));
  }

  .rz-document__fields {
    display: grid;
    gap: var(--rz-size-4);
    align-content: flex-start;
    margin-left: calc(-1 * var(--rz-fields-padding));
    margin-right: calc(-1 * var(--rz-fields-padding));
    padding-block: var(--rz-size-5) var(--rz-size-24);
  }

  .rz-document__infos {
    margin-top: auto;
    border-top: var(--rz-border);
    padding-block: var(--rz-size-6);
  }

  .rz-document__metas {
    font-size: var(--rz-text-xs);
  }

  .rz-document__metas span {
    @mixin font-semibold;
  }
</style>
