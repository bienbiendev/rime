<script lang="ts">
  import { initialValues } from '$lib/core/fields/initial.js';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { GenericBlock } from '$lib/core/prototype/types.js';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { Plus } from '@lucide/svelte';
  import type { BlocksBuilder, BlocksFieldBlock } from '../index.js';
  import BlockPicker from './picker/BlockPicker.svelte';

  type AddBlock = (options: Omit<GenericBlock, 'id' | 'path'>) => void;
  type Props = {
    config: BlocksBuilder;
    addBlock: AddBlock;
  };
  const { config, addBlock }: Props = $props();

  let open = $state(false);

  /** The one type of a list that has one: the button adds it without a menu. */
  const single = $derived(config.get.blocks.length === 1 ? config.get.blocks[0].block : null);

  const add = (block: BlocksFieldBlock) => {
    open = false;
    const empty = {
      ...initialValues(block.fields),
      type: block.name
    };
    addBlock(empty);
  };
</script>

<!-- A ghost "+ Add a block" under the list: one type adds it, several open the picker. -->
<Button
  class="rz-add-block"
  variant="ghost"
  icon={Plus}
  onclick={() => (single ? add(single) : (open = true))}
>
  {t__('fields.add_a_block')}
</Button>

{#if !single}
  <BlockPicker bind:open types={config.get.blocks} onpick={add} />
{/if}

<style type="postcss">
  @import '../../../panel/style/mixins/index.css';

  /* Muted text and a plus, lit on hover. */
  :global(.rz-button.rz-add-block) {
    gap: var(--rz-size-1-5);
    height: var(--rz-size-7);
    padding: 0 var(--rz-size-2) 0 var(--rz-size-1-5);
    border-radius: var(--rz-radius-lg);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-md);
  }

  :global(.rz-button.rz-add-block .rz-button__icon) {
    width: auto;
    height: auto;
    color: var(--rz-fg-subtle);
  }

  :global(.rz-button.rz-add-block:hover:not(:disabled)),
  :global(.rz-button.rz-add-block:hover:not(:disabled) .rz-button__icon) {
    color: var(--rz-fg);
  }
</style>
