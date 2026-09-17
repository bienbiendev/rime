<script lang="ts">
  import { getFieldListAtPath } from '$lib/core/fields/util.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import { withBlockTypes } from '$lib/panel/context/blocks-ops.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { CopyPlus, ToyBrick, Trash2 } from '@lucide/svelte';
  import { getBlocksFocusContext, type LayerRow } from './focus.svelte.js';

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
            <Button size="xs" variant="outline" icon={CopyPlus} onclick={focus.duplicateSelection}>
              {t__('common.duplicate')}
            </Button>
            <Button size="xs" variant="outline" icon={Trash2} onclick={onRemove}>
              {t__('common.delete')}
            </Button>
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
    border: var(--rz-border);
    border-radius: var(--rz-radius-md);
    overflow: hidden;
  }

  .rz-stage__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-4);
    height: var(--rz-row-height);
    padding-inline: var(--rz-size-6) var(--rz-size-3);
    border-bottom: var(--rz-border);
    background-color: hsl(var(--rz-row-bg));
  }

  .rz-stage[data-mode='block'] .rz-stage__header {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .rz-stage__title {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    h3 {
      @mixin font-medium;
      font-size: var(--rz-text-sm);
    }
    &:not(:disabled):hover h3 {
      text-decoration: underline;
    }
  }

  .rz-stage__icon {
    display: flex;
    opacity: 0.7;
  }

  .rz-stage__path {
    font-size: var(--rz-text-2xs);
    color: hsl(var(--rz-color-fg) / 0.4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-stage__actions {
    display: flex;
    gap: var(--rz-size-2);
    flex-shrink: 0;
  }

  .rz-stage__fields {
    padding-block: var(--rz-size-6);
  }

  .rz-stage__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
