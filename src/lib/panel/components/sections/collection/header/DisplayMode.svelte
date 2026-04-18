<script lang="ts">
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import {
    DISPLAY_MODE,
    getCollectionContext,
    type DisplayMode
  } from '$lib/panel/context/collection.svelte.js';
  import { LayoutGrid, List, TextQuote } from '@lucide/svelte';

  const collection = getCollectionContext('list');
  const listIconClass = $derived(collection.isList() ? 'rz-header-display-mode__icon--active' : '');
  const gridIconClass = $derived(collection.isGrid() ? 'rz-header-display-mode__icon--active' : '');
  const nestedIconClass = $derived(
    collection.isNested() ? 'rz-header-display-mode__icon--active' : ''
  );

  const setVariant = (mode: DisplayMode) => (mode === collection.display ? 'secondary' : 'ghost');
  const isActive = (mode: DisplayMode) => mode === collection.display;

  function handleListClick() {
    collection.display = DISPLAY_MODE.LIST;
  }
  function handleGridClick() {
    collection.display = DISPLAY_MODE.GRID;
  }
  function handleNestedClick() {
    collection.display = DISPLAY_MODE.NESTED;
  }
</script>

<div class="rz-header-display-mode">
  <Button
    size="icon-sm"
    variant={setVariant(DISPLAY_MODE.LIST)}
    inert={isActive(DISPLAY_MODE.LIST)}
    onclick={handleListClick}
  >
    <List size={17} class="rz-header-display-mode__icon {listIconClass}" />
  </Button>

  {#if collection.config.upload}
    <Button
      size="icon-sm"
      variant={setVariant(DISPLAY_MODE.GRID)}
      inert={isActive(DISPLAY_MODE.GRID)}
      onclick={handleGridClick}
    >
      <LayoutGrid size={17} class="rz-header-display-mode__icon {gridIconClass}" />
    </Button>
  {/if}
  {#if collection.config.nested}
    <Button
      size="icon-sm"
      variant={setVariant(DISPLAY_MODE.NESTED)}
      inert={isActive(DISPLAY_MODE.NESTED)}
      onclick={handleNestedClick}
    >
      <TextQuote size={17} class="rz-header-display-mode__icon {nestedIconClass}" />
    </Button>
  {/if}
</div>

<style type="postcss" global>
  .rz-header-display-mode {
    display: flex;
    gap: var(--rz-size-2);

    :global(.rz-header-display-mode__icon--active) {
      color: hsl(229, 89%, 60%);
    }
  }
</style>
