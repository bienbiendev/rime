<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import { UPLOAD_PATH } from '$lib/core/prototype/collection/upload/constant.js';
  import type { Directory } from '$lib/core/prototype/collection/upload/types.js';
  import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant.js';
  import type { GenericDoc } from '$lib/core/prototype/types';
  import BulkUploadDialog from '$lib/panel/components/sections/collection/bulk-upload/BulkUploadDialog.svelte';
  import PageDrop from '$lib/panel/components/sections/collection/bulk-upload/PageDrop.svelte';
  import CollectionGrid from '$lib/panel/components/sections/collection/grid/CollectionGrid.svelte';
  import CreateDirectoryDialog from '$lib/panel/components/sections/collection/grid/create-directory-dialog/CreateDirectoryDialog.svelte';
  import ButtonCreate from '$lib/panel/components/sections/collection/header/ButtonCreate.svelte';
  import DisplayMode from '$lib/panel/components/sections/collection/header/DisplayMode.svelte';
  import FilterMenu from '$lib/panel/components/sections/collection/header/FilterMenu.svelte';
  import SearchInput from '$lib/panel/components/sections/collection/header/SearchInput.svelte';
  import SelectUI from '$lib/panel/components/sections/collection/header/SelectUI.svelte';
  import type { KindFilter, StatusFilter } from '$lib/panel/context/collection.svelte.js';
  import { fileSizeLabel, type UploadTarget } from '$lib/panel/util/upload-file.js';
  import CollectionList from '$lib/panel/components/sections/collection/list/CollectionList.svelte';
  import CollectionTree from '$lib/panel/components/sections/collection/tree/CollectionTree.svelte';
  import Page from '$lib/panel/components/sections/page-layout/Page.svelte';
  import Unauthorized from '$lib/panel/components/sections/unauthorized/Unauthorized.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import LanguageSwitcher from '$lib/panel/components/ui/language-switcher/LanguageSwitcher.svelte';
  import PageHeader from '$lib/panel/components/ui/page-header/PageHeader.svelte';
  import { DISPLAY_MODE, setCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { useCommands } from '$lib/panel/context/commands.svelte.js';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { getTitleContext } from '$lib/panel/context/title';
  import {
    CirclePlus,
    FolderPlus,
    LayoutGrid,
    List,
    ListTree,
    Search,
    Upload
  } from '@lucide/svelte';

  type Props = {
    slug: string;
    data: {
      status: number;
      docs: GenericDoc[];
      canCreate: boolean;
      upload?: {
        directories: Directory[];
        currentPath: `root${string}`;
        parentDirectory: Directory;
      };
    };
  };

  const { data, slug }: Props = $props();
  const config = getConfigContext();
  const collectionConfig = $derived(config.getCollection(slug));
  let bulkDialogOpen = $state(false);
  let folderDialogOpen = $state(false);

  // Created once: `Collection.svelte` keys this page on slug, locale and upload folder, so a
  // change that needs a new store remounts it. The effects below carry a reload into it.
  // svelte-ignore state_referenced_locally
  const collection = setCollectionContext({
    initial: data.docs,
    config: collectionConfig,
    canCreate: data.canCreate,
    upload: data.upload
  });

  $effect(() => {
    collection.upload = {
      directories: data.upload?.directories || [],
      currentPath: data.upload?.currentPath || 'root',
      parentDirectory: data.upload?.parentDirectory || null
    };
  });

  $effect(() => {
    collection.docs = data.docs;
  });

  const titleContext = getTitleContext();

  $effect(() => {
    titleContext.value = collection.config.label.plural;
  });

  /** A count in words: `1 file`, `24 documents`, `3 drafts`. */
  const counted = (key: string, count: number) =>
    t__(count === 1 ? key : `${key}|m|p`, String(count));

  // 24 documents · 3 drafts, or 486 files · 1.2 GB · drop files anywhere to upload them
  const metaLine = $derived.by(() => {
    const countKey = collection.isUpload
      ? 'common.collection_count_files'
      : 'common.collection_count';
    const parts = [counted(countKey, collection.total)];
    if (collection.draftsCount) {
      parts.push(counted('common.collection_count_drafts', collection.draftsCount));
    }
    if (collection.isUpload && collection.totalSize) {
      parts.push(fileSizeLabel(collection.totalSize));
    }
    if (collection.isUpload && collection.canCreate) {
      parts.push(t__('common.drop_anywhere'));
    }
    return parts.join(' · ');
  });

  const statusOptions = $derived([
    { value: 'all', label: t__('common.all') },
    { value: VERSIONS_STATUS.DRAFT, label: t__('common.draft') },
    { value: VERSIONS_STATUS.PUBLISHED, label: t__('common.published') }
  ]);

  // All types, Images, Documents… from the files the collection holds.
  const kindOptions = $derived([
    { value: 'all', label: t__('fields.all_types') },
    ...collection.kinds.map((kind) => ({ value: kind, label: t__(`common.media_kind_${kind}`) }))
  ]);

  /** Where uploaded files go: the folder on screen. */
  const uploadTarget = $derived<UploadTarget | null>(
    collection.isUpload
      ? {
          url: collection.apiUrl,
          path: collection.upload.currentPath,
          accept: collection.config.upload?.accept
        }
      : null
  );

  // root:press:team -> team; root -> the collection's name
  const folderName = $derived.by(() => {
    if (!collection.isUpload) return '';
    const name = collection.upload.currentPath.split(UPLOAD_PATH.SEPARATOR).at(-1);
    return !name || name === UPLOAD_PATH.ROOT_NAME ? collection.title : name;
  });

  const createPath = () => {
    const path = panelPath(collection.config.kebab, 'create');
    return collection.isUpload
      ? (`${path}?${PARAMS.UPLOAD_PATH}=${collection.upload.currentPath}` as ResolvedPathname)
      : path;
  };

  const searchInput = () =>
    document.querySelector<HTMLInputElement>('.rz-header-search-input input');

  /** What the list offers: a document, the search, the folders and uploads, the display. */
  useCommands(() => {
    const group = collection.title;
    const label = collection.config.label;
    const displays = [
      { mode: DISPLAY_MODE.LIST, label: t__('common.show_as_list'), icon: List },
      { mode: DISPLAY_MODE.GRID, label: t__('common.show_as_grid'), icon: LayoutGrid },
      ...(collection.config.nested
        ? [{ mode: DISPLAY_MODE.NESTED, label: t__('common.show_as_tree'), icon: ListTree }]
        : [])
    ];
    return [
      {
        id: 'collection.create',
        label: label.create || t__('common.create_new', label.singular),
        group,
        icon: CirclePlus,
        // An upload collection creates its documents through the upload.
        when: () => collection.canCreate && !collection.isUpload,
        run: () => goto(createPath())
      },
      {
        id: 'collection.search',
        label: t__('common.search_in', collection.title),
        group,
        icon: Search,
        when: () => !!searchInput()?.offsetParent,
        run: () => searchInput()?.focus()
      },
      ...(collection.isUpload
        ? [
            {
              id: 'collection.folder',
              label: t__('common.create_folder'),
              group,
              icon: FolderPlus,
              run: () => (folderDialogOpen = true)
            },
            {
              id: 'collection.bulk_upload',
              label: t__('common.collection_upload'),
              group,
              icon: Upload,
              when: () => collection.canCreate,
              run: () => (bulkDialogOpen = true)
            }
          ]
        : []),
      ...displays.map((display) => ({
        id: `collection.display.${display.mode}`,
        label: display.label,
        group,
        icon: display.icon,
        when: () => collection.display !== display.mode,
        run: () => (collection.display = display.mode)
      }))
    ];
  });
</script>

{#if data.status === 200}
  <Page>
    {#snippet main()}
      <div class="rz-collection">
        <PageHeader>
          {#snippet topRight()}
            {#each config.raw.panel.components.collectionHeader || [] as CustomHeaderComponent, index (index)}
              <CustomHeaderComponent config={collectionConfig} />
            {/each}

            <LanguageSwitcher onLocalClick={() => invalidateAll()} />

            {#if collection.isUpload}
              <Button
                variant="ghost"
                size="sm"
                icon={FolderPlus}
                aria-label={t__('common.create_folder')}
                onclick={() => (folderDialogOpen = true)}
              >
                <span class="rz-collection__folder-label">{t__('common.create_folder')}</span>
              </Button>
              {#if collection.canCreate}
                <Button size="sm" icon={Upload} onclick={() => (bulkDialogOpen = true)}>
                  {t__('common.collection_upload')}
                </Button>
              {/if}
            {:else if collection.canCreate}
              <ButtonCreate config={collection.config} variant="default" />
            {/if}
          {/snippet}

          {#snippet title()}
            {collection.title}
          {/snippet}

          {#snippet meta()}
            {metaLine}
          {/snippet}

          {#snippet bottomLeft()}
            <SearchInput />
            {#if !collection.isNested()}
              {#if collection.hasDraft}
                <FilterMenu
                  label={t__('common.status')}
                  options={statusOptions}
                  value={collection.statusFilter}
                  onchange={(value) => (collection.statusFilter = value as StatusFilter)}
                />
              {/if}
              {#if collection.isUpload}
                <FilterMenu
                  label={t__('fields.all_types')}
                  options={kindOptions}
                  value={collection.kindFilter}
                  onchange={(value) => (collection.kindFilter = value as KindFilter)}
                />
              {/if}
            {/if}
            <DisplayMode />
            {#if !collection.isNested()}
              <SelectUI />
            {/if}
          {/snippet}
        </PageHeader>

        <div class="rz-collection__docs">
          {#if collection.isNested()}
            <CollectionTree {collection} />
          {:else if collection.isGrid()}
            <CollectionGrid {collection} oncreatefolder={() => (folderDialogOpen = true)} />
          {:else}
            <CollectionList {collection} />
          {/if}
        </div>
      </div>
    {/snippet}
  </Page>

  {#if uploadTarget}
    <BulkUploadDialog target={uploadTarget} bind:open={bulkDialogOpen} />
    <CreateDirectoryDialog {collection} bind:open={folderDialogOpen} />
    {#if collection.canCreate}
      <PageDrop target={uploadTarget} folder={folderName} disabled={bulkDialogOpen} />
    {/if}
  {/if}
{:else}
  <Unauthorized />
{/if}

<style type="postcss">
  /* The documents run the full width, inside the page's gutter, like the title and the toolbar. */
  .rz-collection__docs {
    container: collection-area / inline-size;
    width: 100%;
    text-align: left;
    padding-top: var(--rz-size-2);
    padding-bottom: var(--rz-size-20);
    padding-inline: var(--rz-page-gutter);
  }

  /* On a narrow page, "New folder" keeps its icon alone. */
  @container main (max-width: 40rem) {
    .rz-collection__folder-label {
      display: none;
    }
  }
</style>
