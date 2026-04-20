<script lang="ts">
  import { goto } from '$app/navigation';
  import type { BuiltConfigClient } from '$lib/core/config/types';
  import { t__ } from '$lib/core/i18n';
  import type { GenericDoc } from '$lib/core/types/doc';
  import LiveSidePanel from '$lib/panel/components/sections/live/SidePanel.svelte';
  import Button from '$lib/panel/components/ui/button/button.svelte';
  import { Pane, PaneGroup, PaneResizer } from '$lib/panel/components/ui/pane/index.js';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { snapshot } from '$lib/util/state';
  import { Laptop, Smartphone } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  type Props = { data: any; config: BuiltConfigClient };
  const { data, config }: Props = $props();

  let iframe: HTMLIFrameElement;
  let iframeSrc = $state('');

  // Normalize URLs by removing trailing slashes
  function normalizeUrl(url: string): string {
    if (!url) return '';
    // Remove trailing slash if it exists
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Compare URLs regardless of trailing slash
  let sync = $derived(normalizeUrl(iframeSrc) === normalizeUrl(data.src));

  const onDataChange = (args: Partial<GenericDoc>) => {
    /** Send message to iframe */
    if (iframe?.contentWindow) {
      // Use snapshot to ensure we're sending a plain object without reactive proxies
      iframe.contentWindow.postMessage(snapshot(args));
    }
  };

  const onFieldFocus = (path: string) => {
    /** Send message to iframe */
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ focus: path });
    }
  };

  // Wrapper tells the iframe it's live - using requestAnimationFrame for better performance
  function handshake() {
    if (sync === false) {
      // Use requestAnimationFrame to yield to the browser for rendering
      requestAnimationFrame(() => {
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ handshake: true });
        }
        // Continue handshake attempts until synced
        // Use setTimeout outside to ensure we don't create a tight animation frame loop
        setTimeout(handshake, 1000);
      });
    }
  }

  const onIframeMessage = async (e: any) => {
    // Handle handshake response from iframe - process in next microtask
    if (e.data.handshake) {
      // Use Promise.resolve().then to defer state update to next microtask
      Promise.resolve().then(() => {
        iframeSrc = e.data.handshake;
      });
    }
    // Handle navigation request from iframe
    if (e.data.location) {
      goto(e.data.location);
    }
  };

  onMount(() => {
    // Set up message listener when component mounts
    window.addEventListener('message', onIframeMessage);
  });

  $effect(() => {
    // Start handshake process when not synced
    if (!sync) {
      handshake();
    }
  });

  $effect(() => {
    // Log when sync is established
    if (sync) {
      console.log('live:synced');
    }
  });

  let currentDevice = $state<'mobile' | 'desktop'>('mobile');
</script>

<div class="rz-live-container">
  {#if !sync}
    <div out:fade={{ duration: 350 }} class="rz-live-container__overlay">
      <div><SpinLoader /> {t__('common.live_in_sync')}</div>
    </div>
  {/if}
  <PaneGroup autoSaveId="rz-live:panel-state" direction="horizontal">
    <Pane defaultSize={40}>
      <div class="rz-live-container__side-panel">
        {#key data.src + data.doc.id + data.locale + data.slug}
          <LiveSidePanel
            {config}
            {onDataChange}
            {onFieldFocus}
            doc={data.doc}
            user={data.user}
            locale={data.locale}
          />
        {/key}
      </div>
    </Pane>
    <PaneResizer />
    <Pane class="rz-live-container__pane-right" defaultSize={70}>
      <div class="rz-live-container__devices">
        <Button
          onclick={() => (currentDevice = 'mobile')}
          variant={currentDevice === 'mobile' ? 'secondary' : 'ghost'}
          size="icon"
          icon={Smartphone}
        />
        <Button
          onclick={() => (currentDevice = 'desktop')}
          variant={currentDevice === 'desktop' ? 'secondary' : 'ghost'}
          size="icon"
          icon={Laptop}
        />
      </div>
      <iframe class={currentDevice} bind:this={iframe} title="edit" src={data.src}></iframe>
    </Pane>
  </PaneGroup>
</div>

<style>
  :global(.rz-scroll-area__viewport) {
    position: relative;
  }
  :global(.rz-live-container__pane-right) {
    position: relative;
    gap: var(--rz-size-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: var(--rz-size-3);
    height: 100vh;
    background-color: hsl(var(--rz-gray-3));
  }

  .rz-live-container__side-panel {
    width: 100%;
    flex-shrink: 0;
    flex-grow: 0;
    border-right: var(--rz-border);
  }

  .rz-live-container iframe {
    border: var(--rz-border);
    transform-origin: center 0;
  }

  .rz-live-container iframe.mobile {
    width: 320px;
    aspect-ratio: 2 / 3.3;
    scale: 1.25;
  }

  .rz-live-container iframe.desktop {
    width: 133%;
    aspect-ratio: 16 / 11;
    scale: 0.75;
  }

  .rz-live-container__overlay {
    background-color: hsl(var(--rz-gray-10));
    opacity: 0.8;
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    > div {
      display: flex;
      align-items: center;
      gap: var(--rz-size-3);
      justify-content: center;
    }
  }

  .rz-live-container__devices {
    display: inline-flex;
    gap: var(--rz-size-3);
    padding: var(--rz-size-2);
    border-radius: var(--rz-radius-md);
    background-color: hsl(var(--rz-gray-2));
  }
</style>
