<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Input from '$lib/panel/components/ui/input/input.svelte';
  import { getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { Search } from '@lucide/svelte';

  const collection = getCollectionContext('list');
  let searchValue = $state('');

  $effect(() => {
    collection.filterBy(searchValue);
  });
</script>

<div class="rz-header-search-input">
  <Input
    name="search"
    icon={Search}
    placeholder={t__('common.search', `${collection.length} document(s)`)}
    type="text"
    bind:value={searchValue}
  />
</div>

<style type="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-header-search-input {
    position: relative;
    display: none;
    height: var(--rz-size-11);
    align-items: center;
    width: var(--rz-size-80);

    :global {
      .rz-input {
        height: var(--rz-size-9);
        font-size: var(--rz-text-sm);
      }
      .rz-input-wrapper {
        width: 100%;
        &:focus-visible {
          @mixin ring var(--rz-color-ring);
        }
      }
    }
  }

  @container (min-width: 720px) {
    .rz-header-search-input {
      display: flex;
    }
  }
</style>
