<script lang="ts">
  import { getFieldListAtPath } from '$lib/core/fields/util.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import RenderFields from '$lib/panel/components/fields/RenderFields.svelte';
  import { Button } from '$lib/panel/components/ui/button/index.js';
  import { withBlockTypes } from '$lib/panel/context/blocks-ops.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { Focus, Plus, ToyBrick } from '@lucide/svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';

  type Props = { form: DocumentFormContext };
  const { form }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const row = $derived(focus.currentRow);

  /** The selected block's fields, but its lists of blocks: those are on the stage already. */
  const rendered = $derived.by(() => {
    if (!row) return null;
    const { fields, path } = getFieldListAtPath(
      withBlockTypes(row.path, form.values),
      form.config.fields
    );
    return { fields: fields.filter((field) => field.type !== 'blocks'), path };
  });

  const countOf = (list: string) => {
    const count = form.blocks.list(list).length;
    return count === 1
      ? t__('fields.blocks_count', '1')
      : t__('fields.blocks_count|m|p', String(count));
  };

  /** Opens the picker on the list: the block picked goes at its end. */
  function addTo(list: string) {
    focus.selectList(list);
    focus.pick();
  }
</script>

{#if row && rendered}
  {@const Icon = row.config?.icon ?? ToyBrick}
  <!--
    The selected block: its head, its fields, then how many blocks each of its lists holds, and a
    button that adds one.
  -->
  <article class="rz-inspector" data-block-path={row.path}>
    <header class="rz-inspector__header">
      <span class="rz-inspector__icon"><Icon size={14} /></span>
      <h3>{row.title}</h3>
      <span class="rz-inspector__path">{row.path}</span>
      {#if row.children.length && !focus.isNarrowedBlock(row.path)}
        <Button
          class="rz-inspector__focus"
          variant="ghost"
          size="sm"
          icon={Focus}
          title={t__('fields.focus_block')}
          aria-label={t__('fields.focus_block')}
          onclick={() => focus.open(row.path)}
        >
          {t__('fields.focus')}
        </Button>
      {/if}
    </header>
    <div class="rz-inspector__fields">
      <RenderFields fields={rendered.fields} path={rendered.path} {form} />
    </div>
    {#if row.children.length}
      <ul class="rz-inspector__lists">
        {#each row.children as child (child.list)}
          <li class="rz-inspector__list">
            <span>{child.label}</span>
            <span class="rz-inspector__count">{countOf(child.list)}</span>
            {#if !focus.locked}
              <button
                type="button"
                class="rz-inspector__add"
                title={t__('fields.add_block')}
                aria-label={t__('fields.add_block')}
                onclick={() => addTo(child.list)}
              >
                <Plus size={14} />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </article>
{/if}

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  /* The head stays on top of the fields, on the page's own fill. */
  .rz-inspector__header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    height: --size(11.5);
    padding-inline: var(--rz-size-3);
    border-bottom: 1px solid var(--rz-border);
    background-color: var(--rz-bg-page);

    h3 {
      @mixin font-medium;
      font-size: var(--rz-text-md);
      white-space: nowrap;
    }
  }

  .rz-inspector__icon {
    display: grid;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-inspector__path {
    min-width: 0;
    font-family: var(--rz-font-mono);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* On the right end of the head. */
  .rz-inspector__header :global(.rz-inspector__focus) {
    flex-shrink: 0;
    margin-left: auto;
  }

  .rz-inspector__fields {
    padding-block: var(--rz-size-6);
  }

  /* Under the fields, past a hairline: each list and its count, in quiet text. */
  .rz-inspector__lists {
    display: grid;
    gap: var(--rz-size-1-5);
    margin: 0 var(--rz-fields-padding) var(--rz-size-16);
    padding-top: var(--rz-size-4);
    border-top: 1px solid var(--rz-border);
    font-size: var(--rz-text-sm);
    color: var(--rz-fg-muted);
  }

  .rz-inspector__list {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
  }

  /* On the right, then the button. */
  .rz-inspector__count {
    margin-left: auto;
    color: var(--rz-fg-subtle);
  }

  .rz-inspector__add {
    display: grid;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    color: var(--rz-fg-subtle);
    &:hover {
      color: var(--rz-fg);
      background-color: var(--rz-bg-hover);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }
</style>
