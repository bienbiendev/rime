<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { useSortable } from '$lib/panel/util/Sortable.js';
  import { capitalize } from '$lib/util/string.js';
  import { ToyBrick } from '@lucide/svelte';
  import { getBlocksFocusContext } from './focus.svelte.js';

  const { form }: { form: DocumentFormContext } = $props();

  const focus = getBlocksFocusContext()!;
  /** The block types of the list the next insert goes to: the current block's, else the open one. */
  const list = $derived(focus.current?.list ?? focus.path ?? '');
  const types = $derived(list ? (form.blocks.builder(list)?.get.blocks ?? []) : []);

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
  <h3 class="rz-palette__heading">{t__('fields.add_block')}</h3>
  <div class="rz-palette__list" use:dragSource>
    {#each types as blockBuilder (blockBuilder.name)}
      {@const block = blockBuilder.block}
      {@const Icon = block.icon ?? ToyBrick}
      <button
        type="button"
        class="rz-palette__item"
        data-type={block.name}
        onclick={() => focus.insertType(block.name)}
      >
        {#if block.image}
          <img src="{env.PUBLIC_RIME_URL}{block.image}" alt="" class="rz-palette__image" />
        {:else}
          <span class="rz-palette__icon"><Icon size={16} /></span>
        {/if}
        <span class="rz-palette__info">
          <span class="rz-palette__title">{block.label || capitalize(block.name)}</span>
          {#if block.description}
            <span class="rz-palette__description">{block.description}</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-palette__heading {
    @mixin font-medium;
    margin-bottom: var(--rz-size-3);
    font-size: var(--rz-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--rz-color-fg) / 0.6);
  }

  .rz-palette__list {
    display: grid;
    gap: var(--rz-size-2);
  }

  .rz-palette__item {
    display: flex;
    align-items: center;
    gap: var(--rz-size-3);
    padding: var(--rz-size-2);
    border: var(--rz-border);
    border-radius: var(--rz-radius-md);
    text-align: left;
    cursor: grab;
    &:hover {
      background-color: hsl(var(--rz-color-fg) / 0.04);
    }
  }

  .rz-palette__icon {
    display: flex;
    width: var(--rz-size-9);
    height: var(--rz-size-9);
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--rz-radius-md);
    background-color: hsl(var(--rz-color-fg) / 0.05);
  }

  .rz-palette__image {
    width: var(--rz-size-12);
    height: var(--rz-size-9);
    object-fit: cover;
    border-radius: var(--rz-radius-sm);
  }

  .rz-palette__info {
    display: grid;
    min-width: 0;
  }

  .rz-palette__title {
    @mixin font-medium;
    font-size: var(--rz-text-xs);
  }

  .rz-palette__description {
    font-size: var(--rz-text-2xs);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
