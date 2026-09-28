<script lang="ts">
  import { panelPath } from '$lib/core/routes/util.js';
  import CommandButton from '$lib/panel/components/sections/commands/CommandButton.svelte';
  import { getConfigContext } from '$lib/panel/context/config.svelte.js';
  import { getNavContext } from '$lib/panel/context/nav.svelte.js';
  import type { Route } from '$lib/panel/types';
  import { PanelLeft, PanelsTopLeft } from '@lucide/svelte';
  import ScrollArea from '../scroll-area/scroll-area.svelte';
  import NavGroup from './NavGroup.svelte';
  import NavItem from './NavItem.svelte';
  import UserButton from './UserButton.svelte';

  type Props = { routes: Record<string, Route[]> };
  const { routes: routesGroups }: Props = $props();

  const nav = getNavContext()!;
  const isCollapsed = $derived(nav.collapsed);

  const config = getConfigContext();
  const navigationGroupsConfig = config.raw.panel.navigation?.groups;

  /** The host of a url, or nothing when it does not parse. */
  function hostOf(url?: string) {
    if (!url) return undefined;
    try {
      return new URL(url).host;
    } catch {
      return undefined;
    }
  }

  // config.siteName, else the host of config.siteUrl, else "rime"
  const siteName = config.raw.siteName || hostOf(config.raw.siteUrl) || 'rime';

  const getGroupIcon = (groupName: string) => {
    if (!navigationGroupsConfig) return null;
    const group = navigationGroupsConfig.find((group) => group.label === groupName);
    if (group) {
      return group.icon;
    }
    return null;
  };

  const dashBoardRoute: Route = {
    title: 'Dashboard',
    url: panelPath(),
    icon: PanelsTopLeft
  };
</script>

<aside class="rz-nav" class:rz-nav--collapsed={isCollapsed}>
  <div class="rz-nav__head">
    {#if !isCollapsed}
      <a class="rz-nav__brand" href={panelPath()}>
        <span class="rz-nav__brand-mark">{siteName.charAt(0)}</span>
        <span class="rz-nav__brand-name">{siteName}</span>
      </a>
    {/if}
    <button
      type="button"
      class="rz-nav__toggle"
      onclick={nav.toggle}
      aria-label="Toggle navigation"
      aria-expanded={!isCollapsed}
    >
      <PanelLeft size="15" />
    </button>
  </div>

  <CommandButton variant={isCollapsed ? 'icon' : 'input'} />

  <div class="rz-nav__body">
    <ScrollArea>
      <nav class="rz-nav__nav">
        <div class="rz-nav__group">
          <NavItem href={panelPath()} {isCollapsed} route={dashBoardRoute} />
          {#each routesGroups.none ?? [] as route (route.url)}
            <NavItem href={route.url} {isCollapsed} {route} />
          {/each}
        </div>
        {#each Object.entries(routesGroups) as [groupName, routes], index (index)}
          {#if groupName !== 'none'}
            {@const icon = getGroupIcon(groupName)}
            <NavGroup name={groupName} {icon} navCollapsed={isCollapsed}>
              {#each routes as route (route.url)}
                <NavItem href={route.url} {isCollapsed} {route} />
              {/each}
            </NavGroup>
          {/if}
        {/each}
      </nav>
    </ScrollArea>
  </div>

  <UserButton navCollapsed={isCollapsed} />
</aside>

<style type="postcss">
  @import '../../../style/mixins/index.css';

  .rz-nav {
    position: fixed;
    z-index: 300;
    top: 0;
    bottom: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-3);
    width: var(--rz-size-60);
    padding: var(--rz-size-3) var(--rz-size-2-5) var(--rz-size-2-5);
    background-color: var(--rz-bg-base);
    box-shadow: inset -1px 0 0 var(--rz-border);
    font-size: var(--rz-text-md);
  }

  .rz-nav--collapsed {
    align-items: center;
    width: var(--rz-size-12);

    :global(.rz-nav-item) {
      justify-content: center;
      width: var(--rz-size-8);
      padding: 0;
    }
  }

  .rz-nav__head {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--rz-size-2);
    width: 100%;
    height: var(--rz-size-8);
    padding-left: var(--rz-size-1-5);
  }

  .rz-nav--collapsed .rz-nav__head {
    justify-content: center;
    padding: 0;
  }

  .rz-nav__brand {
    display: flex;
    align-items: center;
    gap: var(--rz-size-2-5);
    min-width: 0;
    color: var(--rz-fg);
    font-size: var(--rz-text-lg);
    letter-spacing: -0.01em;
    @mixin font-semibold;
  }

  .rz-nav__brand-mark {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-6);
    height: var(--rz-size-6);
    border-radius: var(--rz-radius-sm);
    font-size: var(--rz-text-xs);
    text-transform: uppercase;
    @mixin primary;
  }

  .rz-nav__brand-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rz-nav__toggle {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: var(--rz-size-7);
    height: var(--rz-size-7);
    border-radius: var(--rz-radius-md);
    color: var(--rz-fg-subtle);
    transition:
      background-color 0.15s,
      color 0.15s;

    &:hover {
      background-color: var(--rz-bg-hover);
      color: var(--rz-fg);
    }
    &:focus-visible {
      @mixin focus-ring;
    }
  }

  .rz-nav--collapsed :global(.rz-cmdk-input) {
    flex-shrink: 0;
  }

  .rz-nav__body {
    flex: 1;
    width: 100%;
    min-height: 0;
  }

  .rz-nav__nav {
    display: flex;
    flex-direction: column;
    gap: var(--rz-size-5);
    padding-top: var(--rz-size-2);
  }

  .rz-nav--collapsed .rz-nav__nav {
    align-items: center;
    gap: var(--rz-size-1-5);
  }

  .rz-nav__group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
</style>
