<script lang="ts">
  import { t__ } from '#lib/core/i18n/index.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import Input from '#lib/panel/components/ui/input/input.svelte';
  import { useSortable } from '#lib/panel/util/Sortable.js';
  import { capitalize } from '#lib/util/string.js';
  import Search from '@lucide/svelte/icons/search';
  import { computeCommandScore } from 'bits-ui';
  import BlockTile from '../picker/BlockTile.svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';

  type Props = { form: DocumentFormContext };
  const { form }: Props = $props();

  const focus = getBlocksFocusContext()!;
  /** The block types of the list the next insert goes to. */
  const list = $derived(focus.insertList() ?? '');
  const types = $derived(list ? (form.blocks.builder(list)?.get.blocks ?? []) : []);

  /** Past this many types, a search sits above them. */
  const SEARCH_FROM = 10;
  let query = $state('');
  const searchable = $derived(types.length > SEARCH_FROM);
  /** The types the query names, by label, name or description, in their own order. */
  const shown = $derived.by(() => {
    const words = query.trim();
    if (!searchable || !words) return types;
    return types.filter((builder) => {
      const { block } = builder;
      const label = block.label || capitalize(block.name);
      return computeCommandScore(label, words, [block.name, block.description ?? '']) > 0;
    });
  });

  /**
   * A type drags into the layers and the stage. The row stays here: it is cloned for the drag,
   * and the clone is dropped once the list it landed in has inserted the block.
   */
  const { sortable } = useSortable({
    group: { name: 'rz-blocks-layers', pull: 'clone', put: false },
    sort: false,
    animation: 150,
    disabled: focus.locked,
    onEnd: (event) => event.clone?.remove()
  });

  function dragSource(node: HTMLElement) {
    const instance = sortable(node);
    return { destroy: () => instance.destroy() };
  }
</script>

<div class="rz-palette">
  {#if searchable}
    <div class="rz-palette__search">
      <Input
        name="palette-search"
        type="search"
        icon={Search}
        placeholder={t__('fields.search_blocks')}
        bind:value={query}
      />
    </div>
  {/if}
  <!-- Two tiles a row. A click adds the type, a drag drops it in place. -->
  <div class="rz-palette__list" use:dragSource>
    {#each shown as blockBuilder (blockBuilder.name)}
      {@const block = blockBuilder.block}
      <button
        type="button"
        class="rz-palette__item rz-block-tile"
        data-type={block.name}
        title={block.description || null}
        onclick={() => focus.insertType(block.name)}
      >
        <BlockTile {block} />
      </button>
    {:else}
      <p class="rz-palette__empty">{t__('common.nothing_found')}</p>
    {/each}
  </div>
</div>

<style lang="postcss">
  .rz-palette__search {
    margin-bottom: var(--rz-size-3);
  }

  .rz-palette__empty {
    grid-column: 1 / -1;
    padding: var(--rz-size-4) 0;
    text-align: center;
    font-size: var(--rz-text-sm);
    color: var(--rz-fg-subtle);
  }

  .rz-palette__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--rz-size-2);
  }

  /* A tile drags. */
  .rz-palette__item {
    cursor: grab;
  }
</style>
