<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Input from '$lib/panel/components/ui/input/input.svelte';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { Search } from '@lucide/svelte';

  const collection = getCollectionContext();
  let searchValue = $state('');

  // Search 24 documents...
  const placeholder = $derived.by(() => {
    if (collection.config.label.search) return collection.config.label.search;
    const key = collection.isUpload ? 'common.collection_count_files' : 'common.collection_count';
    const count = t__(collection.total === 1 ? key : `${key}|m|p`, String(collection.total));
    return t__('common.search', count);
  });

  $effect(() => {
    collection.filterBy(searchValue);
  });
</script>

<div class="rz-header-search-input">
  <Input
    name="search"
    icon={Search}
    {placeholder}
    aria-label={placeholder}
    type="text"
    bind:value={searchValue}
  />
</div>

<style type="postcss">
  .rz-header-search-input {
    flex: 1;
    min-width: var(--rz-size-40);
    max-width: var(--rz-size-80);

    :global(.rz-input) {
      height: var(--rz-size-8);
    }
  }
</style>
