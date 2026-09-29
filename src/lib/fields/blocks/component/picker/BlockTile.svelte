<script lang="ts">
  import { capitalize } from '$lib/util/string.js';
  import { ToyBrick } from '@lucide/svelte';
  import type { BlocksFieldBlock } from '../../index.js';

  /**
   * The inside of a type's tile: its thumbnail, or its icon, above its name and description. The
   * element around it carries `rz-block-tile`: a button in the blocks editor, an item in the
   * picker.
   */
  type Props = { block: BlocksFieldBlock };
  const { block }: Props = $props();

  const Thumbnail = $derived(block.thumbnail);
  const Icon = $derived(block.icon ?? ToyBrick);
</script>

<span class="rz-block-tile__frame" data-thumbnail={Thumbnail ? '' : null}>
  {#if Thumbnail}
    <Thumbnail />
  {:else}
    <Icon size={18} />
  {/if}
</span>
<span class="rz-block-tile__title">{block.label || capitalize(block.name)}</span>
{#if block.description}
  <span class="rz-block-tile__description">{block.description}</span>
{/if}

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  /* A raised card, muted until hovered or picked. */
  :global(.rz-block-tile) {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-1-5);
    min-width: 0;
    padding: var(--rz-size-1-5) var(--rz-size-1-5) var(--rz-size-2);
    @mixin surface raised;
    border-radius: var(--rz-radius-xl);
    color: var(--rz-fg-muted);
    font-size: var(--rz-text-sm);
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  :global(.rz-block-tile:hover),
  :global(.rz-block-tile[data-selected]) {
    @mixin hover;
    color: var(--rz-fg);
  }

  :global(.rz-block-tile[data-selected]) {
    box-shadow: 0 0 0 1px var(--rz-accent-border);
  }

  :global(.rz-block-tile:focus-visible) {
    @mixin focus-ring;
  }

  /* 16:10, the thumbnail filling it, or the icon in its middle. */
  .rz-block-tile__frame {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: var(--rz-radius-lg);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-subtle);

    &[data-thumbnail] > :global(svg) {
      display: block;
      width: 100%;
      height: 100%;
    }
  }

  :global(.rz-block-tile:hover) .rz-block-tile__frame,
  :global(.rz-block-tile[data-selected]) .rz-block-tile__frame {
    color: var(--rz-fg-muted);
  }

  .rz-block-tile__title,
  .rz-block-tile__description {
    padding-inline: var(--rz-size-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-block-tile__title {
    @mixin font-medium;
  }

  .rz-block-tile__description {
    margin-top: --size(-1);
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
  }
</style>
