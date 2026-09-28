<script lang="ts">
  import type { IconProps } from '@lucide/svelte';
  import type { Component, Snippet } from 'svelte';

  type Props = {
    title: string;
    icon?: Component<IconProps>;
    /** How many documents the card stands for, after the title. */
    count?: number | null;
    description?: string | null;
    actions?: Snippet;
    children: Snippet;
  };
  const { title, icon: Icon, count, description, actions, children }: Props = $props();
</script>

<section class="rz-dashboard-card">
  <header class="rz-dashboard-card__head">
    <h2 class="rz-dashboard-card__title">
      {#if Icon}
        <Icon size={14} aria-hidden="true" />
      {/if}
      {title}
      {#if typeof count === 'number'}
        <span class="rz-dashboard-card__count">{count}</span>
      {/if}
    </h2>
    {#if description}
      <p class="rz-dashboard-card__description">{description}</p>
    {/if}
    {#if actions}
      <div class="rz-dashboard-card__actions">
        {@render actions()}
      </div>
    {/if}
  </header>

  {@render children()}
</section>

<style type="postcss">
  @import '../../style/mixins/index.css';

  .rz-dashboard-card {
    container: rz-dashboard-card / inline-size;
    @mixin surface raised;
    border-radius: var(--rz-radius-lg);
    overflow: hidden;
  }

  .rz-dashboard-card__head {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2);
    min-height: --size(10.5);
    padding: 0 var(--rz-size-1-5) 0 var(--rz-size-3-5);
  }

  .rz-dashboard-card__title {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--rz-size-2);
    @mixin font-medium;

    :global(svg) {
      color: var(--rz-fg-subtle);
    }
  }

  .rz-dashboard-card__count {
    color: var(--rz-fg-subtle);
    font-size: var(--rz-text-sm);
    font-variant-numeric: tabular-nums;
    @mixin font-normal;
  }

  .rz-dashboard-card__description {
    min-width: 0;
    color: var(--rz-fg-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rz-dashboard-card__actions {
    display: flex;
    align-items: center;
    gap: var(--rz-size-0-5);
    margin-left: auto;
  }
</style>
