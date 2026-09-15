<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { LayoutList } from '@lucide/svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import LayersList from './LayersList.svelte';

  const { form }: { form: DocumentFormContext } = $props();
  const focus = getBlocksFocusContext()!;
</script>

<div class="rz-layers">
  <header class="rz-layers__header">
    <h3>{t__('fields.layers')}</h3>
    <div class="rz-layers__actions">
      <Button size="xs" variant="text" onclick={focus.collapseAll}
        >{t__('fields.collapse_all')}</Button
      >
      <Button size="xs" variant="text" onclick={focus.expandAll}>{t__('fields.expand_all')}</Button>
    </div>
  </header>
  {#if focus.path}
    <!-- The root node: the list itself. Selected, the stage shows every block of it. -->
    <button
      type="button"
      class="rz-layers__root"
      class:rz-layers__root--selected={focus.rootSelected}
      onclick={focus.selectRoot}
    >
      <span class="rz-layers__root-icon"><LayoutList size={12} /></span>
      <span class="rz-layers__root-title">{focus.rootLabel()}</span>
    </button>
    <LayersList {form} list={focus.path} depth={1} />
  {/if}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-layers__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--rz-size-3);
    h3 {
      @mixin font-medium;
      font-size: var(--rz-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: hsl(var(--rz-color-fg) / 0.6);
    }
  }
  .rz-layers__actions {
    display: flex;
  }

  .rz-layers__root {
    @mixin font-medium;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    width: 100%;
    height: var(--rz-size-8);
    padding-inline: var(--rz-size-2);
    margin-bottom: 1px;
    border-radius: var(--rz-radius-sm);
    font-size: var(--rz-text-xs);
    text-align: left;
    &:hover {
      background-color: hsl(var(--rz-color-fg) / 0.04);
    }
  }

  .rz-layers__root--selected,
  .rz-layers__root--selected:hover {
    background-color: hsl(var(--rz-color-fg) / 0.08);
  }

  .rz-layers__root-icon {
    display: flex;
    opacity: 0.7;
  }

  .rz-layers__root-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
