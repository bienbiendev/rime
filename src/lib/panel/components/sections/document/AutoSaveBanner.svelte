<script lang="ts">
  import { PARAMS } from '$lib/core/constants.js';
  import type { AutoSave, AutoSaves } from '$lib/core/prototype/shared/versions/types.js';
  import { panelUrl } from '$lib/core/routes/util.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { getUserContext } from '$lib/panel/context/user.svelte.js';
  import { X } from '@lucide/svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { fade } from 'svelte/transition';
  import { t__ } from '../../../../core/i18n/index.js';
  import Button from '../../ui/button/button.svelte';

  /**
   * The auto-saves written after the row on screen, each with a way to open it.
   *
   * The user's own hides once they type: their typing replaces it. The X closes a banner for this
   * visit and touches nothing — the row stays, listed in the version history, and the banner is
   * back on the next load.
   */

  type Props = { autoSaves: AutoSaves; form: DocumentFormContext };
  const { autoSaves, form }: Props = $props();

  const locale = getLocaleContext();
  const user = getUserContext();

  const doc = $derived(form.values);
  const hasChanges = $derived(Object.keys(form.changes).length > 0);
  const closed = new SvelteSet<string>();

  const time = (date: Date | string | undefined) => (date ? new Date(date).getTime() : 0);
  const isOwn = (autoSave: AutoSave) => autoSave.updatedBy?.id === user.attributes.id;

  const shown = $derived(
    autoSaves.filter(
      (autoSave) =>
        autoSave.id !== doc.versionId &&
        time(autoSave.updatedAt) > time(doc.updatedAt) &&
        !closed.has(autoSave.id) &&
        !(isOwn(autoSave) && hasChanges)
    )
  );

  const documentUrl = (versionId: string) => {
    const kebab = form.config.kebab;
    const base = doc._prototype === 'collection' ? panelUrl(kebab, doc.id ?? '') : panelUrl(kebab);
    return `${base}?${PARAMS.VERSION_ID}=${versionId}`;
  };

  const when = (date: Date | string) => locale.dateFormat(date, { short: true, withTime: true });
  const nameOf = (user: { name?: string; email?: string } | null | undefined) =>
    user?.name || user?.email || t__('common.someone');
</script>

{#if shown.length}
  <!-- Stuck to the bottom of the viewport while the document is on screen: nothing to scroll to. -->
  <div transition:fade class="rz-auto-save-banners">
    {#each shown as autoSave (autoSave.id)}
      <div class="rz-auto-save-banner" data-auto-save={isOwn(autoSave) ? 'own' : 'other'}>
        <p>
          {#if isOwn(autoSave)}
            {t__('common.auto_save_banner_own', when(autoSave.updatedAt))}
          {:else}
            {t__(
              'common.auto_save_banner_other',
              nameOf(autoSave.updatedBy),
              when(autoSave.updatedAt)
            )}
          {/if}
        </p>
        <div class="rz-auto-save-banner__actions">
          <Button size="sm" href={documentUrl(autoSave.id)}>
            {isOwn(autoSave) ? t__('common.auto_save_resume') : t__('common.auto_save_open')}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            icon={X}
            aria-label={t__('common.close')}
            onclick={() => closed.add(autoSave.id)}
          />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style lang="postcss">
  .rz-auto-save-banners {
    position: sticky;
    bottom: 0;
    z-index: 10;
    display: grid;
    gap: var(--rz-size-2);
    padding-block: var(--rz-size-3);
    padding-inline: max(var(--rz-page-gutter), calc((100% - var(--rz-document-width, 60rem)) / 2));
    background-color: light-dark(hsl(var(--rz-gray-19)), hsl(var(--rz-gray-4)));
  }
  .rz-auto-save-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-4);
    padding: var(--rz-size-3) var(--rz-size-4);
    border: 1px solid hsl(var(--rz-color-warn) / 0.5);
    border-radius: var(--rz-radius-lg);
    font-size: var(--rz-text-sm);
    background-color: hsl(var(--rz-color-warn) / 0.12);
  }
  .rz-auto-save-banner__actions {
    display: flex;
    gap: var(--rz-size-2);
    flex-shrink: 0;
  }
</style>
