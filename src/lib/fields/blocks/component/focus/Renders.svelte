<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { getBlocksFocusContext } from './focus.svelte.js';
  import RenderPlaceholder from './RenderPlaceholder.svelte';
  import Renders from './Renders.svelte';

  type Props = { form: DocumentFormContext; list: string };
  const { form, list }: Props = $props();

  const focus = getBlocksFocusContext()!;
  const rows = $derived(focus.rowsOf(list));

  /** A click selects the row and stops there: a render's own links and buttons do nothing. */
  function select(event: MouseEvent, rowPath: string) {
    event.preventDefault();
    event.stopPropagation();
    focus.select(rowPath, { extend: event.shiftKey });
  }
</script>

<!--
  One list of blocks, one wrapper per block. A block's nested lists are the `nested` snippet its
  render puts where they go; a block without a render is a placeholder card with them below.
-->
<div class="rz-renders" data-list={list}>
  {#each rows as row (row.block.id)}
    {@const config = row.config}
    {#snippet nested(name?: string)}
      {#each row.children.filter((child) => !name || child.builder.name === name) as child (child.list)}
        <Renders {form} list={child.list} />
      {/each}
    {/snippet}
    <div
      class="rz-renders__item"
      data-path={row.path}
      data-type={row.block.type}
      data-selected={focus.isSelected(row.path) ? '' : undefined}
      role="button"
      tabindex="0"
      onclick={(event) => select(event, row.path)}
      onkeydown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault();
          focus.select(row.path);
        }
      }}
    >
      {#if config?.render}
        {@const Render = config.render}
        <svelte:boundary>
          <Render
            block={row.block}
            path={row.path}
            fields={config.fields}
            {form}
            children={nested}
          />
          {#snippet failed(error)}
            <RenderPlaceholder {row} {error} children={nested} />
          {/snippet}
        </svelte:boundary>
      {:else}
        <RenderPlaceholder {row} children={nested} />
      {/if}
    </div>
  {:else}
    {#if list === focus.path}
      <p class="rz-renders__empty">{t__('fields.no_blocks_yet_render')}</p>
    {/if}
  {/each}
</div>

<style lang="postcss">
  .rz-renders {
    display: grid;
    gap: var(--rz-size-3);
  }

  .rz-renders__item {
    border-radius: var(--rz-radius-md);
    outline: 1px solid transparent;
    outline-offset: 3px;
    cursor: pointer;

    &:hover {
      outline-color: hsl(var(--rz-color-fg) / 0.15);
    }
    &:focus-visible {
      outline-color: hsl(var(--rz-color-fg) / 0.3);
    }
  }

  .rz-renders__item[data-selected],
  .rz-renders__item[data-selected]:hover {
    outline: 2px solid hsl(var(--rz-color-fg) / 0.6);
  }

  .rz-renders__empty {
    padding: var(--rz-size-16) var(--rz-size-6);
    text-align: center;
    font-size: var(--rz-text-sm);
    color: hsl(var(--rz-color-fg) / 0.5);
  }
</style>
