<script lang="ts">
  import { t__ } from '$lib/core/i18n/index.js';
  import { ToyBrick } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { LayerRow } from './focus.svelte.js';

  type Props = { row: LayerRow; error?: unknown; children?: Snippet<[name?: string]> };
  const { row, error, children }: Props = $props();

  const Icon = $derived(row.config?.icon ?? ToyBrick);

  $effect(() => {
    if (error) console.error(`Render of block ${row.path} failed`, error);
  });
</script>

<!-- A block without a render, or one whose render threw: its icon, its title, its nested lists. -->
<div class="rz-render-placeholder" data-error={error ? '' : undefined}>
  <p class="rz-render-placeholder__title">
    <span class="rz-render-placeholder__icon"><Icon size={14} /></span>
    <span>{row.title}</span>
    {#if error}
      <span class="rz-render-placeholder__error">{t__('fields.render_failed')}</span>
    {/if}
  </p>
  {@render children?.()}
</div>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-render-placeholder {
    display: grid;
    gap: var(--rz-size-3);
    padding: var(--rz-size-3) var(--rz-size-4);
    border: 1px dashed var(--rz-border-strong);
    border-radius: var(--rz-radius-md);
  }

  .rz-render-placeholder__title {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    font-size: var(--rz-text-sm);
    @mixin font-medium;
  }

  .rz-render-placeholder__icon {
    display: grid;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    flex-shrink: 0;
    border-radius: var(--rz-radius-sm);
    background-color: var(--rz-bg-well);
    color: var(--rz-fg-muted);
  }

  .rz-render-placeholder__error {
    @mixin font-normal;
    color: var(--rz-danger);
  }
</style>
