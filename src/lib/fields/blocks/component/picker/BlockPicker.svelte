<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import * as Command from '$lib/panel/components/ui/command/index.js';
  import Kbd from '$lib/panel/components/ui/kbd/Kbd.svelte';
  import { capitalize } from '$lib/util/string.js';
  import { Command as CommandPrimitive } from 'bits-ui';
  import type { BlockBuilder, BlocksFieldBlock } from '../../index.js';
  import BlockTile from './BlockTile.svelte';

  /** The types to add, as tiles in a dialog: a search above, the arrows walk the grid. */
  type Props = {
    open: boolean;
    types: BlockBuilder[];
    onpick: (block: BlocksFieldBlock) => void;
  };
  let { open = $bindable(false), types, onpick }: Props = $props();

  const COLUMNS = 3;

  function pick(block: BlocksFieldBlock) {
    open = false;
    onpick(block);
  }
</script>

<Command.Dialog bind:open columns={COLUMNS}>
  <Command.Input placeholder={t__('fields.search_blocks')}>
    {#snippet end()}
      <Kbd keys="escape" />
    {/snippet}
  </Command.Input>
  <Command.List class="rz-block-picker">
    <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
    <div class="rz-block-picker__grid" style:--rz-block-picker-columns={COLUMNS}>
      {#each types as builder (builder.name)}
        {@const block = builder.block}
        <CommandPrimitive.Item
          class="rz-block-tile"
          value={block.label || capitalize(block.name)}
          keywords={[block.name, block.description ?? '']}
          onSelect={() => pick(block)}
        >
          <BlockTile {block} />
        </CommandPrimitive.Item>
      {/each}
    </div>
  </Command.List>
  <footer class="rz-block-picker__foot">
    <span><Kbd keys="arrowup" /><Kbd keys="arrowdown" /> {t__('common.palette_move')}</span>
    <span><Kbd keys="enter" /> {t__('fields.picker_add')}</span>
    <span><Kbd keys="escape" /> {t__('common.palette_close')}</span>
  </footer>
</Command.Dialog>

<style lang="postcss">
  /* Wider than the command palette, for three tiles a row. */
  :global(.rz-command-dialog-content:has(.rz-block-picker)) {
    width: min(46rem, calc(100% - 2 * var(--gutter)));
  }

  :global(.rz-command-list.rz-block-picker) {
    max-height: min(60vh, 32rem);
    padding: var(--rz-size-3);
  }

  .rz-block-picker__grid {
    display: grid;
    grid-template-columns: repeat(var(--rz-block-picker-columns), minmax(0, 1fr));
    gap: var(--rz-size-2-5);
  }

  .rz-block-picker__foot {
    display: flex;
    align-items: center;
    gap: var(--rz-size-4);
    height: var(--rz-size-9);
    padding: 0 var(--rz-size-3-5);
    border-top: 1px solid var(--rz-border);
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);

    span {
      display: inline-flex;
      align-items: center;
      gap: var(--rz-size-1);
    }
  }
</style>
