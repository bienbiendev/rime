<script lang="ts">
  import { page } from '$app/state';
  import type { User } from '$lib/core/collections/auth/types.js';
  import type { BuiltConfigClient } from '$lib/core/config/types.js';
  import Nav from '$lib/panel/components/ui/nav/Nav.svelte';
  import { Toaster } from '$lib/panel/components/ui/sonner';
  import { setConfigContext } from '$lib/panel/context/config.svelte.js';
  import createContext from '$lib/panel/context/createContext.svelte.js';
  import { setLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { setUserContext } from '$lib/panel/context/user.svelte.js';
  import type { Route } from '$lib/panel/types.js';
  import { onMount, type Snippet } from 'svelte';
  import { API_PROXY, setAPIProxyContext } from '../context/api-proxy.svelte.js';

  type Props = {
    routes: Record<string, Route[]>;
    children: Snippet;
    locale: string | undefined;
    config: BuiltConfigClient;
    user: User;
  };
  const { config, routes, children, locale: initialeLocale, user }: Props = $props();

  let isCollapsed = $state(false);
  let localeCollapsed = $state<string | null>(null);

  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(user);
  createContext('title', '[untitled]');
  setAPIProxyContext(API_PROXY.ROOT);

  const locale = $derived(setLocaleContext(initialeLocale));

  function onResize() {
    if (window.innerWidth < 1024) {
      isCollapsed = true;
    } else {
      if (!localeCollapsed || localeCollapsed === 'false') {
        isCollapsed = false;
        localeCollapsed = 'false';
      }
    }
  }

  const setCollapsed = (bool: boolean) => {
    isCollapsed = bool;
    localeCollapsed = bool.toString();
    localStorage.setItem('rz-panel-collapsed', bool.toString());
  };

  onMount(() => {
    localeCollapsed = localStorage.getItem('rz-panel-collapsed');
    if (localeCollapsed) {
      setCollapsed(localeCollapsed === 'true');
    }
    onResize();
  });
</script>

<svelte:window on:resize={onResize} />

<Toaster />

<div class="rz-panel-root">
  <Nav {setCollapsed} {routes} {isCollapsed} />
  {#key `${page.url}${locale.code || ''}`}
    <div class="rz-panel-root__right" class:rz-panel-root__right--navCollapsed={isCollapsed}>
      {@render children()}
    </div>
  {/key}
</div>

<style>
  .rz-panel-root {
    container-type: inline-size;
    container-name: rz-panel;
    font-family: var(--rz-font-sans);
    background-color: hsl(var(--rz-color-bg));
    min-height: 100vh;
  }

  .rz-panel-root__right {
    margin-left: var(--rz-size-72);
  }

  .rz-panel-root__right--navCollapsed {
    margin-left: var(--rz-size-20);
  }
</style>
