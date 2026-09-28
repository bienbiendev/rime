<script lang="ts">
  import { page } from '$app/state';
  import { getTitleContext } from '$lib/panel/context/title';
  import type { Route } from '$lib/types';
  import { ChevronRight } from '@lucide/svelte';

  const titleContext = getTitleContext();

  const aria = $derived<Route[]>(page.data.aria ?? []);

  // The sidebar already leads to the dashboard: its crumb shows on the dashboard alone.
  const crumbs = $derived(aria.length > 1 && aria[0].icon === 'dashboard' ? aria.slice(1) : aria);
</script>

<nav class="rz-aria" aria-label="Breadcrumb">
  {#each crumbs as route, index (index)}
    {#if index < crumbs.length - 1 && route.url}
      <a class="rz-aria__link" href={route.url}>{route.title}</a>
      <ChevronRight class="rz-aria__separator" size={13} aria-hidden="true" />
    {:else}
      <span class="rz-aria__last" aria-current="page">{route.title || titleContext.value}</span>
    {/if}
  {/each}
</nav>

<style lang="postcss">
  @import '../../../../panel/style/mixins/index.css';

  .rz-aria {
    display: flex;
    align-items: center;
    gap: var(--rz-size-1-5);
    min-width: 0;
    color: var(--rz-fg-subtle);
    white-space: nowrap;

    :global(.rz-aria__separator) {
      flex-shrink: 0;
    }
  }

  .rz-aria__link {
    max-width: var(--rz-size-40);
    overflow: hidden;
    border-radius: var(--rz-radius-sm);
    text-overflow: ellipsis;
    transition: color 0.15s;

    &:hover {
      color: var(--rz-fg);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-aria__last {
    overflow: hidden;
    color: var(--rz-fg);
    text-overflow: ellipsis;
    @mixin font-medium;
  }
</style>
