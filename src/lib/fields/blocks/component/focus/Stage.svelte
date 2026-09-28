<script lang="ts">
  import { getFieldListAtPath } from '$lib/core/fields/util.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import { withBlockTypes } from '$lib/panel/context/blocks-ops.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { CopyPlus, ToyBrick, Trash2 } from '@lucide/svelte';
  import { getBlocksFocusContext, type LayerRow } from './focus.svelte.js';
  import StagePlaceholder from './StagePlaceholder.svelte';

  type Props = { form: DocumentFormContext; onRemove: () => void };
  const { form, onRemove }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const current = $derived(focus.currentRow);
  /** A block selected: that block alone. The root node: every block of the open list. */
  const rows = $derived(current ? [current] : focus.path ? focus.rowsOf(focus.path) : []);

  const fieldsOf = (row: LayerRow) =>
    getFieldListAtPath(withBlockTypes(row.path, form.values), form.config.fields);
</script>

<div class="rz-stage" data-mode={current ? 'block' : 'all'}>
  {#each rows as row (row.block.id)}
    {@const Icon = row.config?.icon ?? ToyBrick}
    {@const rendered = fieldsOf(row)}
    <article class="rz-stage__card" data-block-path={row.path}>
      <header class="rz-stage__header">
        <button
          type="button"
          class="rz-stage__title"
          onclick={() => focus.select(row.path)}
          disabled={!!current}
        >
          <span class="rz-stage__icon"><Icon size={14} /></span>
          <h3>{row.title}</h3>
          <span class="rz-stage__path">{row.path}</span>
        </button>
        {#if current && !focus.locked}
          <div class="rz-stage__actions">
            <Button
              variant="ghost"
              size="icon-sm"
              icon={CopyPlus}
              title={t__('common.duplicate')}
              aria-label={t__('common.duplicate')}
              onclick={focus.duplicateSelection}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              icon={Trash2}
              title={t__('fields.delete_block')}
              aria-label={t__('fields.delete_block')}
              onclick={onRemove}
            />
          </div>
        {/if}
      </header>
      <div class="rz-stage__fields">
        <RenderFields fields={rendered.fields} path={rendered.path} {form} />
      </div>
    </article>
  {:else}
    <p class="rz-stage__empty">{t__('fields.no_blocks_yet')}</p>
  {/each}
  {#if !current && rows.length && !focus.locked}
    <StagePlaceholder />
  {/if}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-stage {
    display: grid;
    align-content: start;
    gap: var(--rz-size-6);
    min-height: 100%;
    padding-bottom: var(--rz-size-16);
  }

  .rz-stage[data-mode='all'] {
    padding: var(--rz-size-6) var(--rz-size-6) var(--rz-size-16);
  }

  .rz-stage[data-mode='all'] .rz-stage__card {
    @mixin surface raised;
    border-radius: var(--rz-radius-md);
    overflow: hidden;
  }

  /* A block's head: its icon, its title, its path, and on the right what it can do. */
  .rz-stage__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    height: --size(11.5);
    padding-inline: var(--rz-size-3) var(--rz-size-1-5);
    border-bottom: 1px solid var(--rz-border);
    background-color: var(--rz-bg-raised);
  }

  /* Alone, the head stays on top of the fields, on the page's own fill. */
  .rz-stage[data-mode='block'] .rz-stage__header {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--rz-bg-page);
  }

  .rz-stage__title {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    h3 {
      @mixin font-medium;
      font-size: var(--rz-text-md);
      white-space: nowrap;
    }
    &:not(:disabled):hover h3 {
      text-decoration: underline;
    }
  }

  .rz-stage__icon {
    display: grid;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-stage__path {
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Ghost icon buttons, quiet until hovered. */
  .rz-stage__actions {
    --rz-button-ghost-fg: var(--rz-fg-muted);
    display: flex;
    gap: var(--rz-size-0-5);
    flex-shrink: 0;
    :global(.rz-button) {
      width: var(--rz-size-7);
      height: var(--rz-size-7);
    }
    :global(.rz-button:hover) {
      color: var(--rz-fg);
    }
  }

  .rz-stage__fields {
    padding-block: var(--rz-size-6);
  }

  .rz-stage__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: var(--rz-fg-subtle);
  }
</style>
