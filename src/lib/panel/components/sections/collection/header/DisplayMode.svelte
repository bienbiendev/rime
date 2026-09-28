<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { DISPLAY_MODE, getCollectionContext } from '$lib/panel/context/collection.svelte.js';
  import { LayoutGrid, List, ListTree } from '@lucide/svelte';

  const collection = getCollectionContext();

  const modes = $derived([
    { mode: DISPLAY_MODE.LIST, label: t__('common.show_as_list'), icon: List },
    { mode: DISPLAY_MODE.GRID, label: t__('common.show_as_grid'), icon: LayoutGrid },
    ...(collection.config.nested
      ? [{ mode: DISPLAY_MODE.NESTED, label: t__('common.show_as_tree'), icon: ListTree }]
      : [])
  ]);
</script>

<!-- A segmented control: a well track, the current mode a knob inside it. -->
<div class="rz-header-display-mode" role="group" aria-label={t__('common.collection_display')}>
  {#each modes as { mode, label, icon: Icon } (mode)}
    <button
      type="button"
      class="rz-header-display-mode__button"
      aria-label={label}
      aria-pressed={collection.display === mode}
      title={label}
      onclick={() => (collection.display = mode)}
    >
      <Icon size={14} />
    </button>
  {/each}
</div>

<style type="postcss">
  @import '../../../../style/mixins/index.css';

  .rz-header-display-mode {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--rz-radius-lg);
    background-color: var(--rz-bg-well);
    box-shadow: inset 0 0 0 1px var(--rz-border);
  }

  .rz-header-display-mode__button {
    display: grid;
    place-items: center;
    width: var(--rz-size-7);
    height: var(--rz-size-6);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-muted);
    transition: color 0.15s;

    &:hover {
      color: var(--rz-fg);
    }

    &[aria-pressed='true'] {
      @mixin knob;
      color: var(--rz-fg);
    }

    &:focus-visible {
      @mixin focus-ring;
      outline-offset: 0;
    }
  }
</style>
