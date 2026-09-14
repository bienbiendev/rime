<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PARAMS } from '$lib/core/constants.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import * as Sheet from '$lib/panel/components/ui/sheet/index.js';
  import { getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import type { DocVersion } from '$lib/panel/index.js';
  import { toKebabCase } from '$lib/util/string.js';
  import { Trash2, X } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';
  import ScrollArea from '../../ui/scroll-area/scroll-area.svelte';
  import StatusDot from '../collection/StatusDot.svelte';
  import { versionsApiUrl, versionsListUrl } from './versions-list.js';

  /**
   * The document's version history, opened from the settings menu.
   *
   * `doc` is the row on screen: its `versionId` marks the active entry, and picking another entry
   * loads that row into the same page by `?versionId=`. The list comes from the API proxy, so an
   * auto-save or a save in the form re-reads it.
   */
  type Props = { doc: GenericDoc; open?: boolean; versionId?: string };
  let { doc, open = $bindable(false), versionId }: Props = $props();

  /** The row on screen: the form's when it says, the loaded document's otherwise. */
  const activeId = $derived(versionId ?? doc.versionId);

  const locale = getLocaleContext();
  const user = getUserContext();
  const APIProxy = getAPIProxyContext();
  const config = getConfigContext();

  const Icon = $derived(
    config.getDocumentConfig({ prototype: doc._prototype, slug: doc._type }).icon
  );

  const resource = $derived(APIProxy.getRessource<{ docs: DocVersion[] }>(versionsListUrl(doc)));
  const list = $derived(resource.data?.docs ?? []);

  const documentPath = (versionId?: string) => {
    const kebab = toKebabCase(doc._type);
    const base = doc._prototype === 'collection' ? panelPath(kebab, doc.id) : panelPath(kebab);
    return versionId ? `${base}?${PARAMS.VERSION_ID}=${versionId}` : base;
  };

  const isOwn = (version: DocVersion) => version.updatedBy?.id === user.attributes.id;

  /** An auto-saved row is labelled by whose typing it is; a version by its status. */
  const autoSaveLabel = (version: DocVersion) =>
    isOwn(version)
      ? t__('common.your_auto_save')
      : t__(
          'common.auto_save_by',
          version.updatedBy?.name || version.updatedBy?.email || t__('common.someone')
        );

  /** The owner drops their own auto-save. Off the row on screen, the page lands on the newest. */
  async function discard(version: DocVersion) {
    const response = await fetch(`${versionsApiUrl(doc._type)}/${version.id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      toast.error(t__('error.generic'));
      return;
    }
    APIProxy.invalidate(versionsApiUrl(doc._type));
    if (activeId === version.id) await goto(resolve(documentPath()));
    else await invalidateAll();
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content side="right" showCloseButton={false}>
    <aside class="rz-document-versions">
      <ScrollArea>
        <div class="rz-document-versions__header">
          <Button
            size="icon-sm"
            variant="ghost"
            icon={X}
            aria-label={t__('common.close')}
            onclick={() => (open = false)}
          ></Button>
          <h2>{t__('common.versions_history')}</h2>
        </div>

        <div class="rz-document-versions__list">
          {#each list as version (version.id)}
            <div
              class="rz-document-versions__list-item"
              class:rz-document-versions__list-item--active={activeId === version.id}
              class:rz-document-versions__list-item--auto-save={version.isAutoSave}
              data-version-auto-save={version.isAutoSave
                ? isOwn(version)
                  ? 'own'
                  : 'other'
                : undefined}
            >
              <a onclick={() => (open = false)} href={resolve(documentPath(version.id))}>
                <Icon size="11" />
                <span>{locale.dateFormat(version.updatedAt!, { short: true, withTime: true })}</span
                >
                {#if version.isAutoSave}
                  <span class="rz-document-versions__label">{autoSaveLabel(version)}</span>
                {/if}
              </a>
              {#if version.isAutoSave && isOwn(version)}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Trash2}
                  aria-label={t__('common.auto_save_discard')}
                  onclick={() => discard(version)}
                ></Button>
              {:else}
                <StatusDot --rz-dot-size="0.5rem" status={version.status} />
              {/if}
            </div>
          {/each}
        </div>
      </ScrollArea>
    </aside>
  </Sheet.Content>
</Sheet.Root>

<style lang="postcss">
  .rz-document-versions {
    .rz-document-versions__list {
      padding: var(--rz-size-5);
      margin-top: var(--rz-size-4);
      display: grid;
      gap: var(--rz-size-2);
    }
    :global(.rz-scroll-area) {
      height: 100vh;
    }
  }

  .rz-document-versions__list-item {
    height: calc(var(--rz-input-height));
    padding: 0 var(--rz-size-6);
    display: flex;
    border-radius: var(--rz-radius-lg);
    align-items: center;
    background-color: light-dark(hsl(var(--rz-gray-19)), hsl(var(--rz-gray-3)));
    justify-content: space-between;
    &.rz-document-versions__list-item--active {
      background-color: light-dark(hsl(var(--rz-gray-16)), hsl(var(--rz-gray-4)));
    }
  }

  .rz-document-versions__list-item a {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--rz-size-3);
    min-width: 0;
  }

  .rz-document-versions__list-item--active a {
    text-decoration: underline;
  }

  .rz-document-versions__list-item--auto-save {
    opacity: 0.7;
    padding-right: var(--rz-size-3);
  }

  .rz-document-versions__label {
    font-size: var(--rz-text-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-document-versions__header {
    display: flex;
    gap: var(--rz-size-2);
    padding: var(--rz-size-5) var(--rz-size-5) 0 var(--rz-size-5);
    margin-left: calc(-1 * var(--rz-size-2));
    align-items: center;
  }
  h2 {
    @mixin font-bold;
  }
</style>
