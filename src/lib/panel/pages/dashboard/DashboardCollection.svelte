<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import Empty from '$lib/panel/components/sections/collection/Empty.svelte';
  import GridItem from '$lib/panel/components/sections/collection/grid/grid-item/GridItem.svelte';
  import ButtonCreate from '$lib/panel/components/sections/collection/header/ButtonCreate.svelte';
  import Row from '$lib/panel/components/sections/collection/list/row/Row.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { ChevronRight } from '@lucide/svelte';

  import type { DashboardEntry } from './types.js';

  type Props = { entry: DashboardEntry & { prototype: 'collection' } };
  const { entry }: Props = $props();

  const config = getConfigContext();
  const collectionConfig = $derived(config.getCollection(entry.slug));
</script>

<section>
  <header>
    <div>
      <h2>{entry.title}</h2>
      {#if entry.canCreate}
        <ButtonCreate config={collectionConfig} size="sm" />
      {/if}
      <p>{entry.description}</p>
    </div>
    <Button variant="text" href={entry.link}>
      {t__('common.view_all')}
      <ChevronRight size={12} />
    </Button>
  </header>
  {#if entry.lastEdited?.length === 0}
    <Empty config={collectionConfig} />
  {:else}
    <div class="rz-dashboard-collection__list rz-dashboard-collection__list--{entry.layout}">
      {#each entry.lastEdited as doc, index (index)}
        {#if entry.layout === 'grid'}
          <GridItem isSelectMode={false} config={collectionConfig} {doc} checked={false} />
        {:else}
          <Row isSelectMode={false} config={collectionConfig} {doc} checked={false} />
        {/if}
      {/each}
    </div>
  {/if}
</section>

<style lang="postcss">
  @import '../../style/mixins/index.css';

  header {
    display: flex;
    gap: var(--rz-size-2);
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--rz-size-2);
    > div {
      display: flex;
      gap: var(--rz-size-2);
      align-items: center;
    }
    p {
      opacity: 0.5;
      @mixin line-clamp 1;
    }
  }
  h2 {
    font-weight: 600;
    font-size: var(--rz-size-4);
  }

  .rz-dashboard-collection__list {
    display: grid;
    gap: var(--rz-size-2);
  }

  .rz-dashboard-collection__list--grid {
    --columns: 1;
    grid-template-columns: repeat(var(--columns), minmax(150px, 1fr));
    @media (min-width: 640px) {
      --columns: 2;
    }
    @media (min-width: 1024px) {
      --columns: 3;
    }
    @media (min-width: 1280px) {
      --columns: 4;
    }
  }
</style>
