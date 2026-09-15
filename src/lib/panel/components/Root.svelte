<script lang="ts">
  import type { User } from '$lib/core/auth/types.js';
  import type { BuiltConfigClient } from '$lib/core/config/types.js';
  import Nav from '$lib/panel/components/ui/nav/Nav.svelte';
  import { Toaster } from '$lib/panel/components/ui/sonner';
  import { setConfigContext } from '$lib/panel/context/config.svelte.js';
  import { setLocaleContext } from '$lib/panel/context/locale.svelte.js';
  import { setNavContext } from '$lib/panel/context/nav.svelte.js';
  import { setUserContext } from '$lib/panel/context/user.svelte.js';
  import type { Route } from '$lib/panel/types.js';
  import type { Snippet } from 'svelte';
  import { setAPIProxyContext } from '../context/api-proxy.svelte.js';
  import { setTitleContext } from '../context/title.js';

  type Props = {
    routes: Record<string, Route[]>;
    children: Snippet;
    locale: string | undefined;
    config: BuiltConfigClient;
    user: User;
  };
  const { config, routes, children, locale: initialeLocale, user }: Props = $props();

  const nav = setNavContext();

  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(user);
  setTitleContext('[untitled]');
  setAPIProxyContext();

  // svelte-ignore state_referenced_locally
  const locale = setLocaleContext(initialeLocale);

  // The layout reloads the locale after a switch; the store follows it in place, and whatever
  // shows locale-dependent content is keyed on it where it stands.
  $effect(() => {
    locale.code = initialeLocale;
  });
</script>

<Toaster />

<div class="rz-panel-root">
  <Nav {routes} />
  <div class="rz-panel-root__right" class:rz-panel-root__right--navCollapsed={nav.collapsed}>
    {@render children()}
  </div>
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
    margin-left: var(--rz-size-14);
  }
</style>
