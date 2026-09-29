<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { capitalize } from '$lib/util/string.js';
  import { ToyBrick } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { LayerRow } from './focus.svelte.js';

  type Props = { row: LayerRow; error?: unknown; children?: Snippet<[name?: string]> };
  const { row, error, children }: Props = $props();

  const Icon = $derived(row.config?.icon ?? ToyBrick);
  const label = $derived(row.config?.label || capitalize(row.block.type));

  $effect(() => {
    if (error) console.error(`Render of block ${row.path} failed`, error);
  });
</script>

<!--
  A block without a render, or one whose render threw: a row with its icon, its title and its
  type, then its lists of blocks under it. Its fields are in the inspector.
-->
<div class="rz-default-render" data-error={error ? '' : undefined}>
  <p class="rz-default-render__row">
    <span class="rz-default-render__icon"><Icon size={14} /></span>
    <span class="rz-default-render__title">{row.title}</span>
    {#if row.title !== label}
      <span class="rz-default-render__type">{label}</span>
    {/if}
    {#if error}
      <span class="rz-default-render__error">{t__('fields.render_failed')}</span>
    {/if}
  </p>
  {#if row.children.length}
    <div class="rz-default-render__children">{@render children?.()}</div>
  {/if}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-default-render {
    @mixin surface raised;
    border-radius: var(--rz-radius-md);
  }

  .rz-default-render__row {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-width: 0;
    height: --size(11);
    padding-inline: var(--rz-size-3);
    font-size: var(--rz-text-sm);
  }

  .rz-default-render__icon {
    display: grid;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-default-render__title {
    @mixin font-medium;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-default-render__type {
    flex-shrink: 0;
    font-size: var(--rz-text-xs);
    color: var(--rz-fg-subtle);
  }

  .rz-default-render__error {
    color: var(--rz-danger);
  }

  /* The block's lists, indented under its row. */
  .rz-default-render__children {
    display: grid;
    gap: var(--rz-size-3);
    padding: 0 var(--rz-size-3) var(--rz-size-3) var(--rz-size-10);
  }
</style>
