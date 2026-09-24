<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import type { ResolvedPathname } from '$app/types';
  import { PARAMS } from '$lib/core/constants.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import { panelPath } from '$lib/core/routes/util.js';
  import type { Directory } from '$lib/core/prototype/collection/upload/types.js';
  import type { GenericDoc } from '$lib/core/prototype/types';
  import BulkUploadDialog from '$lib/panel/components/sections/collection/bulk-upload/BulkUploadDialog.svelte';
  import CommandButton from '$lib/panel/components/sections/commands/CommandButton.svelte';
  import CollectionGrid from '$lib/panel/components/sections/collection/grid/CollectionGrid.svelte';
  import CreateDirectoryDialog from '$lib/panel/components/sections/collection/grid/create-directory-dialog/CreateDirectoryDialog.svelte';
  import ButtonCreate from '$lib/panel/components/sections/collection/header/ButtonCreate.svelte';
  import CollectionHeader from '$lib/panel/components/sections/collection/header/Header.svelte';
  import SearchInput from '$lib/panel/components/sections/collection/header/SearchInput.svelte';
  import Separator from '$lib/panel/components/sections/collection/header/Separator.svelte';
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
    CopyPlus,
    FolderPlus,
    LayoutGrid,
    List,
    Search,
    TextQuote
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
        ? [{ mode: DISPLAY_MODE.NESTED, label: t__('common.show_as_tree'), icon: TextQuote }]
        : [])
    ];
    return [
      {
        id: 'collection.create',
        label: label.create || t__('common.create_new', label.singular),
        group,
        icon: CirclePlus,
        when: () => collection.canCreate,
        run: () => goto(createPath())
      },
      {
        id: 'collection.search',
        label: t__('common.search_in', collection.title),
        group,
        icon: Search,
        // The header hides its input on a narrow page.
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
              label: t__('common.bulk_upload_dialog_title'),
              group,
              icon: CopyPlus,
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
      <PageHeader>
        {#snippet title()}
          {collection.title}
        {/snippet}

        {#snippet bottomLeft()}
          {#if collection.canCreate}
            <ButtonCreate config={collection.config} size="sm" />
          {/if}
          {#if collection.isUpload}
            <Separator />
            <Button
              onclick={() => (bulkDialogOpen = true)}
              icon={CopyPlus}
              size="sm"
              variant="text"
            >
              Bulk upload
            </Button>
          {/if}
          <CollectionHeader />
        {/snippet}

        {#snippet topRight()}
          {#each config.raw.panel.components.collectionHeader || [] as CustomHeaderComponent, index (index)}
            <CustomHeaderComponent config={collectionConfig} />
          {/each}

          <CommandButton />
          <LanguageSwitcher onLocalClick={() => invalidateAll()} />
        {/snippet}

        {#snippet bottomRight()}
          <SearchInput />
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
    {/snippet}
  </Page>

  <BulkUploadDialog {collection} bind:open={bulkDialogOpen} />
  {#if collection.isUpload}
    <CreateDirectoryDialog {collection} bind:open={folderDialogOpen} />
  {/if}
{:else}
  <Unauthorized />
{/if}

<style type="postcss">
  .rz-collection__docs {
    container: collection-area / inline-size;
    width: 100%;
    text-align: left;
    padding: var(--rz-size-6) var(--rz-page-gutter);
    & :global(.rz-scroll-area) {
      height: calc(100vh - 7.5rem);
      width: 100%;
    }
    & :global(.rz-scroll-area--grid) {
      height: calc(100vh - 3.5rem);
      background-color: hsl(var(--rz-gray-10));
    }
    & :global(.rz-scroll-area--nested) {
      height: calc(100vh - 3.5rem);
      background-color: hsl(var(--rz-gray-10));
    }
  }
</style>
