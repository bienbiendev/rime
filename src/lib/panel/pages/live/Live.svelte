<script lang="ts">
  import { goto } from '$app/navigation';
  import type { BuiltConfigClient } from '$lib/core/config/types';
  import { t__ } from '$lib/core/i18n';
  import LiveEditPanel from '$lib/panel/components/sections/live/LiveEditPanel.svelte';
  import LiveFloatingUI from '$lib/panel/components/sections/live/LiveFloatingUI.svelte';
  import { Pane, PaneGroup, PaneResizer } from '$lib/panel/components/ui/pane/index.js';
  import { Toaster } from '$lib/panel/components/ui/sonner';
  import SpinLoader from '$lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { setAPIProxyContext } from '$lib/panel/context/api-proxy.svelte';
  import { setConfigContext } from '$lib/panel/context/config.svelte';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { setLivePanelContext, type ActivePanel } from '$lib/panel/context/livePanel.svelte.js';
  import { setLocaleContext } from '$lib/panel/context/locale.svelte';
  import { setTitleContext } from '$lib/panel/context/title';
  import { setUserContext } from '$lib/panel/context/user.svelte';
  import { panelPath } from '$lib/panel/util/url.js';
  import type { GenericDoc, User } from '$lib/types';
  import { trycatchFetch } from '$lib/util/function';
  import { snapshot } from '$lib/util/state';
  import { toKebabCase } from '$lib/util/string';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  type Data = {
    doc: GenericDoc;
    user: User;
    src: string;
    slug: string;
    locale: string | undefined;
  };

  type Props = { data: Data; config: BuiltConfigClient };
  const { data, config }: Props = $props();

  setAPIProxyContext();
  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(data.user);
  // svelte-ignore state_referenced_locally
  setLocaleContext(data.locale);
  setTitleContext('[untitled]');

  // One entry per unique `update` key — never removed once added
  let panelContexts = $state<Record<string, { doc: any }>>({});
  // Collected from LivePanelContext children after mount
  let panelForms = $state<Record<string, DocumentFormContext>>({});
  // Stack-based navigation: last entry is the active panel, Escape pops one level
  let panelStack = $state<ActivePanel[]>([]);
  // The active panel is the last entry in the stack, or null if the stack is empty
  const activePanel = $derived(panelStack.at(-1) ?? null);
  // The root document panel is the first panel activated with fieldPath === ''
  let rootDocumentPanel = $state<ActivePanel>();

  let paneLeft: ReturnType<typeof Pane>;
  const VALID_UPDATE = /^\/[a-z][a-z0-9-]*(?:\/[a-zA-Z0-9_-]+)?(?:\?[a-zA-Z0-9_=&%.-]*)?$/;
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

  // Send a snapshot of the current state to the iframe
  function makePanelOnDataChange(update: string) {
    return ({ path, value }: { path: string; value: any }) => {
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(snapshot({ update, path, value }));
    };
  }

  // Send a snapshot of the current state to the iframe after a successful save
  function makeAfterSuccess(update: string) {
    return (savedDoc: any) => {
      // Update the cached doc so future re-activations seed the correct base
      if (panelContexts[update]) panelContexts[update] = { doc: savedDoc };
      // Re-seed the iframe with server-confirmed data
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(snapshot({ update, path: '', value: savedDoc }));
      }
    };
  }

  // Validate the update URI format and extract slug and id
  function parseUpdate(update: string): { slug: string; id?: string } | null {
    if (!VALID_UPDATE.test(update)) return null;
    const [, slug, id] = update.split('/');
    return { slug, id };
  }

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
        setTimeout(handshake, 300);
      });
    }
  }

  const iframeOrigin = $derived.by(() => {
    try {
      return new URL(data.src).origin;
    } catch {
      return null;
    }
  });

  async function activatePanel(key: string, update: string, fieldPath: string) {
    const parsed = parseUpdate(update);
    if (!parsed) return console.warn(`Invalid update key: ${update}`);

    if (!panelContexts[update]) {
      const url = parsed.id ? `/api/${parsed.slug}/${parsed.id}` : `/api/${parsed.slug}`;
      const res = await fetch(url);
      if (!res.ok) return;
      panelContexts[update] = { doc: (await res.json()).doc };

      // Seed liveStore only on FIRST activation — never overwrite live edits on re-click
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          snapshot({ update, path: '', value: panelContexts[update].doc })
        );
      }
    }

    if (!rootDocumentPanel && fieldPath === '') {
      rootDocumentPanel = { key, update, fieldPath };
    }

    // Push onto the stack — each nested LivePanel click adds a level
    panelStack = [...panelStack.filter((item) => item.key !== key), { key, update, fieldPath }];
  }

  const onIframeMessage = async (e: MessageEvent) => {
    // Only accept messages from the expected iframe origin
    if (!iframeOrigin || e.origin !== iframeOrigin) return;

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

    // Handle custom panel activation
    if (e.data.activatePanel) {
      const { key, update, fieldPath } = e.data.activatePanel;
      activatePanel(key, update, fieldPath);
    }

    if (e.data.deactivatePanel) {
      // Pop the top level — Escape returns to the previous panel in the stack
      const { key } = e.data.deactivatePanel;
      if (panelStack.at(-1)?.key === key) {
        panelStack = panelStack.slice(0, -1);
      }
    }
  };

  onMount(() => {
    // Set up message listener when component mounts
    window.addEventListener('message', onIframeMessage);
  });

  $effect(() => {
    // Check wether the iframe src has a 200 status code and is reachable
    trycatchFetch(data.src, { method: 'HEAD' }).then(([error, response]) => {
      if (error || !response?.ok) {
        console.error(`Error loading iframe, check your routes for ${data.src}`);
      } else {
        // Start handshake process when not synced
        if (!sync) {
          handshake();
        }
      }
    });
  });

  $effect(() => {
    // Log when sync is established
    if (sync) {
      console.log('live:synced');
    }
  });

  $effect(() => {
    if (!paneLeft) return;
    if (activePanel) {
      paneLeft.expand();
    } else {
      paneLeft.collapse();
    }
  });

  // Notify the iframe whenever the active panel changes so LivePanel knows its state
  $effect(() => {
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ activePanel: activePanel?.key ?? null });
  });

  let currentDevice = $state<'mobile' | 'desktop'>('mobile');

  // Expose active panel state to all child components (LiveEditPanel etc.)
  setLivePanelContext({
    get activePanel() {
      return activePanel;
    },
    get panelStack() {
      return panelStack;
    }
  });

  function closeActivePanel() {
    if (activePanel) {
      panelStack = panelStack.slice(0, -1);
    } else {
      backToDocumentPanel();
    }
  }

  function backToDocumentPanel() {
    const slug = data.slug;
    const id = data.doc.id;

    // Start with the base URI for the panel, adding the item ID if present
    const panelUri = id ? panelPath(toKebabCase(slug), id) : panelPath(toKebabCase(slug));
    return goto(panelUri);
  }

  function toggleRootPanel() {
    if (rootDocumentPanel) {
      if (activePanel?.key === rootDocumentPanel.key) {
        closeActivePanel();
      } else {
        activatePanel(rootDocumentPanel.key, rootDocumentPanel.update, rootDocumentPanel.fieldPath);
      }
    }
  }

  function handleIFrameError() {
    console.error('Error loading iframe:', data.src);
  }
</script>

<div class="rz-live-container">
  {#if !sync}
    <div out:fade={{ duration: 150 }} class="rz-live-container__overlay">
      <div><SpinLoader /> {t__('common.live_in_sync')}</div>
    </div>
  {/if}

  <Toaster />

  <LiveFloatingUI
    bind:currentDevice
    forms={panelForms}
    onClose={closeActivePanel}
    {activePanel}
    toggleRootPanel={rootDocumentPanel ? toggleRootPanel : null}
  />

  <PaneGroup direction="horizontal">
    <Pane bind:this={paneLeft} collapsedSize={0} collapsible={true} defaultSize={30}>
      {#if activePanel && panelContexts[activePanel.update]}
        {#key activePanel.update}
          <LiveEditPanel
            doc={panelContexts[activePanel.update].doc}
            onDataChange={makePanelOnDataChange(activePanel.update)}
            afterSuccess={makeAfterSuccess(activePanel.update)}
            onFormReady={(form) => {
              panelForms[activePanel.update] = form;
            }}
          />
        {/key}
      {/if}
    </Pane>

    <PaneResizer />
    <Pane class="rz-live-container__pane-right" defaultSize={70}>
      <iframe
        class={currentDevice}
        bind:this={iframe}
        title="edit"
        src={data.src}
        onerror={handleIFrameError}
      ></iframe>
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
    height: 100vh;
    background-color: hsl(var(--rz-gray-3));
  }

  .rz-live-container__side-panel {
    width: 100%;
    flex-shrink: 0;
    flex-grow: 0;
    border-right: var(--rz-border);
  }

  :global(.rz-live-hidden) {
    display: none;
  }

  .rz-live-container iframe {
    transform-origin: center 0;
  }

  .rz-live-container iframe.mobile {
    width: 320px;
    aspect-ratio: 2 / 3.3;
    scale: 1.25;
    transform: translateY(-6.25vh);
  }

  :global(.rz-live-container__pane-right):has(iframe.mobile) {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rz-live-container iframe.desktop {
    width: 100%;
    height: 100%;
    padding: var(--rz-size-6);
  }

  .rz-live-container__overlay {
    background-color: light-dark(hsl(var(--rz-gray-18)), hsl(var(--rz-gray-2)));
    color: light-dark(hsl(var(--rz-gray-2)), hsl(var(--rz-gray-18)));
    opacity: 0.93;
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
</style>
