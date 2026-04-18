<script lang="ts">
  import { apiUrl } from '$lib/core/api/index.js';
  import type { Directory } from '$lib/core/collections/upload/upload';
  import { t__ } from '$lib/core/i18n/index.js';
  import { withDirectoriesSuffix } from '$lib/core/naming.js';
  import Empty from '$lib/panel/components/sections/collection/Empty.svelte';
  import Folder from '$lib/panel/components/sections/collection/folder/Folder.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import CardDocument from '$lib/panel/components/ui/card-document/card-document.svelte';
  import * as Dialog from '$lib/panel/components/ui/dialog/index.js';
  import * as DropdownMenu from '$lib/panel/components/ui/dropdown-menu/index.js';
  import Input from '$lib/panel/components/ui/input/input.svelte';
  import { API_PROXY, getAPIProxyContext } from '$lib/panel/context/api-proxy.svelte.js';
  import type { BuiltCollection, UploadDoc } from '$lib/types';
  import { ListFilter, Search } from '@lucide/svelte';

  type Props = { open: boolean; addValue: (item: string) => void; config: BuiltCollection };
  let { open = $bindable(), addValue, config }: Props = $props();

  let path = $state('root');
  let searchValue = $state('');
  let typeFilterValue = $state('');
  let initialDocs = $state<UploadDoc[]>([]);

  const isFiltered = $derived.by(() => {
    return searchValue.trim() !== '' || typeFilterValue !== '';
  });

  const encodedMime = $derived.by(() => {
    if (typeFilterValue) {
      return encodeURIComponent(typeFilterValue);
    }
    return '';
  });

  const parentPath = $derived.by(() => {
    if (path.includes(':')) {
      const segments = path.split(':');
      return segments.slice(0, -1).join(':');
    } else {
      return null;
    }
  });

  const filesURL = $derived.by(() => {
    if (!isFiltered) {
      return `${apiUrl(config.kebab)}?where[_path][equals]=${path}`;
    } else {
      if (typeFilterValue && searchValue.trim()) {
        return `${apiUrl(config.kebab)}?where[and][0][mimeType][equals]=${encodedMime}&where[and][1][filename][like]=%${searchValue.trim()}%`;
      } else if (typeFilterValue) {
        return `${apiUrl(config.kebab)}?where[mimeType][equals]=${encodedMime}`;
      } else if (searchValue.trim()) {
        return `${apiUrl(config.kebab)}?where[filename][like]=%${searchValue.trim()}%`;
      } else {
        return `${apiUrl(config.kebab)}?where[_path][equals]=${path}`;
      }
    }
  });

  const foldersURL = $derived.by(() => {
    return `${apiUrl(withDirectoriesSuffix(config.kebab))}?where[parent][equals]=${path}`;
  });

  const APIProxy = getAPIProxyContext(API_PROXY.DOCUMENT);
  let files = $derived(APIProxy.getRessource<{ docs: UploadDoc[] }>(filesURL));
  let folders = $derived(APIProxy.getRessource<{ docs: Directory[] }>(foldersURL));

  $effect(() => {
    if (!initialDocs.length && files.data?.docs.length) {
      initialDocs = files.data.docs;
    }
  });

  const fileTypes = $derived.by(() => {
    if (initialDocs.length) {
      const types = new Set(initialDocs.map((doc) => doc.mimeType));
      return Array.from(types);
    }
    return [];
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content size="xl">
    <div class="rz-relation-browse">
      <!-- Header -->
      <div class="rz-relation-browse__header">
        <!--  -->
        <Input
          icon={Search}
          class="rz-header-search-input__input"
          placeholder={t__('common.search', `${initialDocs.length || 0} document(s)`)}
          type="text"
          bind:value={searchValue}
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger disabled={fileTypes.length <= 1}>
            {#snippet child({ props })}
              <Button variant="secondary" icon={ListFilter} {...props}>
                {typeFilterValue || t__('fields.all_types')}
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>

          <!-- <DropdownMenu.Portal> -->
          <DropdownMenu.Content class="rz-link__type-content" align="start">
            <DropdownMenu.Item onclick={() => (typeFilterValue = '')}>
              {t__('fields.all_types')}
            </DropdownMenu.Item>
            {#each fileTypes as type, index (index)}
              <DropdownMenu.Item onclick={() => (typeFilterValue = type)}>
                {type}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
          <!-- </DropdownMenu.Portal> -->
        </DropdownMenu.Root>
      </div>

      <!-- Grid -->
      <div class="rz-relation-browse__grid-wrapper">
        <div class="rz-relation-browse__grid">
          {#if isFiltered && files.data?.docs.length === 0}
            <Empty {config} />
          {/if}

          {#if parentPath}
            <button class="rz-browse__folder" onclick={() => (path = parentPath)}>
              <Folder>...</Folder>
            </button>
          {/if}

          {#if !isFiltered}
            {#if folders.data}
              {#each folders.data.docs as doc (doc.id)}
                <button class="rz-browse__folder" onclick={() => (path = doc.id)}>
                  <Folder>{doc.name}</Folder>
                </button>
              {/each}
            {/if}
          {/if}

          {#if files.data}
            {#each files.data.docs as doc (doc.id)}
              <button onclick={() => addValue(doc.id)}>
                <CardDocument {doc} />
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

<style lang="postcss">
  .rz-relation-browse {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    :global {
      .rz-no-document {
        grid-column: 1 / -1;
      }
    }
  }

  .rz-relation-browse__header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--rz-size-4);
    padding-bottom: var(--rz-size-4);
    border-bottom: var(--rz-border);

    padding-right: var(--rz-size-8);
    position: sticky;
    top: 0;
    background-color: hsl(var(--rz-color-bg));
    z-index: 10;

    :global {
      .rz-dropdown-item {
        padding: var(--rz-size-3) var(--rz-size-3);
      }
      .rz-input-wrapper {
        max-width: 50%;
      }
      .rz-input {
        height: var(--rz-size-9);
      }
    }
  }

  .rz-relation-browse__grid-wrapper {
    overflow-y: scroll;
    flex: 1;
    min-height: 0;
  }

  .rz-relation-browse__grid {
    padding-top: var(--rz-size-4);
    display: grid;
    align-self: start;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    grid-auto-rows: auto;
    gap: var(--rz-size-4);
    width: 100%;

    &::after {
      content: '';
      height: 5rem;
      position: absolute;
      left: 0;
      bottom: 0;
      right: 0;
      z-index: 2;
      background-image: linear-gradient(to top, hsl(var(--rz-color-bg)), transparent);
    }
  }

  .rz-browse__folder {
    width: 100%;
    aspect-ratio: 4 / 5;
    padding: var(--rz-size-5);
    border-radius: var(--rz-radius-lg);
    &:hover {
      background-color: var(--rz-folder-hover-bg);
    }
  }
</style>
