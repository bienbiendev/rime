<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { UPLOAD_PATH } from '$lib/core/prototype/collection/upload/constant.js';
  import type { GenericDoc } from '$lib/core/prototype/types.js';
  import { apiUrl, panelPath } from '$lib/core/routes/util.js';
  import Avatar from '$lib/panel/components/sections/collection/Avatar.svelte';
  import DocStatus from '$lib/panel/components/sections/collection/DocStatus.svelte';
  import When from '$lib/panel/components/sections/collection/When.svelte';
  import BulkUploadDialog from '$lib/panel/components/sections/collection/bulk-upload/BulkUploadDialog.svelte';
  import GridItem from '$lib/panel/components/sections/collection/grid/grid-item/GridItem.svelte';
  import ButtonCreate from '$lib/panel/components/sections/collection/header/ButtonCreate.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import { ChevronRight, Upload } from '@lucide/svelte';
  import DashboardCard from './DashboardCard.svelte';
  import DashboardRow from './DashboardRow.svelte';
  import type { DashboardEntry } from './types.js';

  type Props = { entry: DashboardEntry & { prototype: 'collection' }; now: Date };
  const { entry, now }: Props = $props();

  const config = getConfigContext();
  const collectionConfig = $derived(config.getCollection(entry.slug));
  const docs = $derived(entry.lastEdited ?? []);
  const hasDrafts = $derived(!!collectionConfig.versions?.draft);
  const isUpload = $derived(!!collectionConfig.upload);
  // The people of an auth collection show as avatars, their role after their name.
  const isPeople = $derived(!!collectionConfig.auth);
  let uploadOpen = $state(false);

  // /panel/pages/create, and /panel/medias/create?uploadPath=root for an upload collection
  const createHref = $derived.by((): ResolvedPathname => {
    const createPath = panelPath(collectionConfig.kebab, 'create');
    if (!isUpload) return createPath;
    return `${createPath}?${PARAMS.UPLOAD_PATH}=${UPLOAD_PATH.ROOT_NAME}` as ResolvedPathname;
  });

  // The files uploaded from the dashboard land in the root folder.
  const uploadTarget = $derived({
    url: apiUrl(collectionConfig.kebab),
    path: UPLOAD_PATH.ROOT_NAME,
    accept: collectionConfig.upload?.accept
  });

  const nameOf = (doc: GenericDoc): string => doc.name || doc.title || '[untitled]';

  // ['editor'] -> 'Editor'
  const roleOf = (doc: GenericDoc): string =>
    Array.isArray(doc.roles) && typeof doc.roles[0] === 'string' ? capitalize(doc.roles[0]) : '';
</script>

<DashboardCard
  title={entry.title}
  icon={config.raw.icons[entry.slug]}
  count={entry.count}
  description={entry.description}
>
  {#snippet actions()}
    {#if entry.canCreate && isUpload}
      <Button
        variant="ghost"
        size="icon-sm"
        class="rz-dashboard-collection__upload"
        icon={Upload}
        aria-label={t__('common.collection_upload')}
        title={t__('common.collection_upload')}
        onclick={() => (uploadOpen = true)}
      />
    {:else if entry.canCreate}
      <ButtonCreate config={collectionConfig} size="sm" />
    {/if}
    <a class="rz-dashboard-collection__more" href={entry.link}>
      {t__('common.view_all')}<span class="rz-sr-only"> {entry.title}</span>
      <ChevronRight size={12} aria-hidden="true" />
    </a>
  {/snippet}

  {#if docs.length === 0}
    <p class="rz-dashboard-collection__empty">
      {collectionConfig.label.none || t__('common.no_documents_yet', entry.title)}
      {#if entry.canCreate}
        <a href={createHref}>{t__('common.create_first_one')}</a>
      {/if}
    </p>
  {:else if entry.layout === 'grid'}
    <div class="rz-dashboard-collection__grid">
      {#each docs as doc (doc.id)}
        <GridItem isSelectMode={false} config={collectionConfig} {doc} checked={false} />
      {/each}
    </div>
  {:else}
    <ul class="rz-dashboard-collection__rows">
      {#each docs as doc (doc.id)}
        {#if isPeople}
          <DashboardRow href={panelPath(collectionConfig.kebab, doc.id)} title={nameOf(doc)}>
            {#snippet lead()}
              <Avatar name={nameOf(doc)} />
            {/snippet}
            {#if roleOf(doc)}
              <span class="rz-dashboard-collection__role">{roleOf(doc)}</span>
            {/if}
          </DashboardRow>
        {:else}
          <DashboardRow
            href={panelPath(collectionConfig.kebab, doc.id)}
            title={doc.title || '[untitled]'}
          >
            {#if hasDrafts && doc.status}
              <DocStatus status={doc.status} />
            {/if}
            {#if doc.updatedAt}
              <When date={doc.updatedAt} {now} />
            {/if}
          </DashboardRow>
        {/if}
      {/each}
    </ul>
  {/if}
</DashboardCard>

{#if entry.canCreate && isUpload}
  <BulkUploadDialog target={uploadTarget} bind:open={uploadOpen} />
{/if}

<style type="postcss">
  @import '../../style/mixins/index.css';

  /* A plain upload arrow, subtle until hovered, like the plus of the other cards. */
  :global(.rz-button.rz-dashboard-collection__upload) {
    width: var(--rz-size-7);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-subtle);

    &:hover {
      color: var(--rz-fg);
    }
  }

  .rz-dashboard-collection__more {
    display: inline-flex;
    align-items: center;
    gap: var(--rz-size-0-5);
    height: var(--rz-size-7);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-2);
    border-radius: var(--rz-radius-sm);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
    white-space: nowrap;

    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
    }

    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-dashboard-collection__empty {
    padding: var(--rz-size-3) var(--rz-size-3-5) var(--rz-size-3-5);
    box-shadow: inset 0 1px 0 var(--rz-border);
    color: var(--rz-fg-subtle);

    a {
      color: var(--rz-accent-text);

      &:hover {
        text-decoration: underline;
      }

      &:focus-visible {
        @mixin focus-ring;
      }
    }
  }

  .rz-dashboard-collection__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--rz-size-3);
    padding: var(--rz-size-0-5) var(--rz-size-3-5) var(--rz-size-3-5);
  }

  @container rz-dashboard-card (min-width: 30rem) {
    .rz-dashboard-collection__grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .rz-dashboard-collection__role {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    white-space: nowrap;
  }
</style>
