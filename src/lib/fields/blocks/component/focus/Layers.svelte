<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { LayoutList } from '@lucide/svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import LayersList from './LayersList.svelte';

  /** `heading` off where a tab names it already. */
  type Props = { form: DocumentFormContext; heading?: boolean };
  const { form, heading = true }: Props = $props();
  const focus = getBlocksFocusContext()!;
  /** Folding means something once a block holds a list of its own. */
  const nested = $derived(focus.allRows().some((row) => row.children.length > 0));
</script>

<div class="rz-layers">
  {#if heading || nested}
    <header class="rz-layers__header">
      {#if heading}
        <h3>{t__('fields.layers')}</h3>
      {/if}
      {#if nested}
        <div class="rz-layers__actions">
          <Button size="xs" variant="ghost" onclick={focus.collapseAll}>
            {t__('fields.collapse_all')}
          </Button>
          <Button size="xs" variant="ghost" onclick={focus.expandAll}>
            {t__('fields.expand_all')}
          </Button>
        </div>
      {/if}
    </header>
  {/if}
  {#if focus.path}
    <!-- The root node: the open list, or the narrowed block. Selected, nothing is. -->
    <button
      type="button"
      class="rz-layers__root"
      class:rz-layers__root--selected={focus.rootSelected}
      onclick={focus.selectRoot}
    >
      <span class="rz-layers__root-icon"><LayoutList size={13} /></span>
      <span class="rz-layers__root-title">{focus.rootLabel()}</span>
    </button>
    {#if focus.narrowedRow}
      <!-- Narrowed to a block: the lists it holds, each under its name when there are several. -->
      {@const lists = focus.narrowedRow.children}
      {#each lists as child (child.list)}
        <LayersList
          {form}
          list={child.list}
          depth={1}
          label={lists.length > 1 ? child.label : undefined}
        />
      {/each}
    {:else}
      <LayersList {form} list={focus.path} depth={1} />
    {/if}
  {/if}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-layers__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    padding: 0 var(--rz-size-0-5) 0 var(--rz-size-2);
    margin-bottom: var(--rz-size-1);
    h3 {
      @mixin font-medium;
      font-size: var(--rz-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rz-fg-subtle);
    }
  }

  /* Small ghost text on the right, quiet until hovered. */
  .rz-layers__actions {
    display: flex;
    gap: var(--rz-size-0-5);
    margin-left: auto;

    :global(.rz-button) {
      font-size: var(--rz-text-xs);
      color: var(--rz-fg-subtle);
    }
    :global(.rz-button:hover:not(:disabled)) {
      color: var(--rz-fg);
    }
  }

  /* The list's own row, like a layer's: muted, lit on hover, shaded when selected. */
  .rz-layers__root {
    @mixin font-medium;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    width: 100%;
    height: --size(8.5);
    padding-inline: var(--rz-size-2);
    margin-bottom: 1px;
    border-radius: var(--rz-radius-lg);
    font-size: var(--rz-text-md);
    color: var(--rz-fg-muted);
    text-align: left;
    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-layers__root--selected,
  .rz-layers__root--selected:hover {
    background-color: var(--rz-bg-active);
    color: var(--rz-fg);
  }

  .rz-layers__root-icon {
    display: grid;
    place-items: center;
    width: --size(5.5);
    height: --size(5.5);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-layers__root-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
