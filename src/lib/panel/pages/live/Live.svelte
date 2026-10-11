<script lang="ts">
  import { goto } from '$app/navigation';
  import type { BuiltConfigClient } from '#lib/core/config/types.js';
  import { t__ } from '#lib/core/i18n/index.js';
  import { API_PREFIX } from '#lib/core/routes/constants.js';
  import { panelPath } from '#lib/core/routes/util.js';
  import LiveEditPanel from '#lib/panel/components/sections/live/LiveEditPanel.svelte';
  import Commands from '#lib/panel/components/sections/commands/Commands.svelte';
  import LiveFloatingUI from '#lib/panel/components/sections/live/LiveFloatingUI.svelte';
  import { Pane, PaneGroup, PaneResizer } from '#lib/panel/components/ui/pane/index.js';
  import { Toaster } from '#lib/panel/components/ui/sonner/index.js';
  import SpinLoader from '#lib/panel/components/ui/spin-loader/SpinLoader.svelte';
  import { setAPIProxyContext } from '#lib/panel/context/api-proxy.svelte.js';
  import { setConfigContext } from '#lib/panel/context/config.svelte.js';
  import type { DocumentFormContext } from '#lib/panel/context/documentForm.svelte.js';
  import { setLivePanelContext, type ActivePanel } from '#lib/panel/context/livePanel.svelte.js';
  import { setLocaleContext } from '#lib/panel/context/locale.svelte.js';
  import { setTitleContext } from '#lib/panel/context/title.js';
  import { setUserContext } from '#lib/panel/context/user.svelte.js';
  import type { GenericDoc, User } from '#lib/types.js';
  import { trycatchFetch } from '#lib/util/function.js';
  import { snapshot } from '#lib/util/state.js';
  import { withLocale } from '#lib/panel/util/url.js';
  import { toKebabCase } from '#lib/util/string.js';
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

  // svelte-ignore state_referenced_locally
  setConfigContext(config);
  // svelte-ignore state_referenced_locally
  setUserContext(data.user);
  // svelte-ignore state_referenced_locally
  const locale = setLocaleContext(data.locale);
  setAPIProxyContext(() => locale.code);
  setTitleContext('');

  // One entry per unique `update` key — never removed once added
  let panelContexts = $state<Record<string, { doc: any }>>({});
  // One form per `update` key, handed over by LiveEditPanel's `onFormReady`.
  let panelForms = $state<Record<string, DocumentFormContext>>({});
  // Stack-based navigation: last entry is the active panel, Escape pops one level
  let panelStack = $state<ActivePanel[]>([]);
  // The active panel is the last entry in the stack, or null if the stack is empty
  const activePanel = $derived(panelStack.at(-1) ?? null);
  // The root document panel is the first panel activated with fieldPath === ''
  let rootDocumentPanel = $state<ActivePanel>();

  let paneLeft: ReturnType<typeof Pane>;
  // An update key is an API path without `/api`: `/blog-posts/123?locale=fr`, `/infos`
  const VALID_UPDATE = /^\/[a-z][a-z0-9-]*(?:\/[a-zA-Z0-9_-]+)?(?:\?[a-zA-Z0-9_=&%.-]*)?$/;
  let iframe: HTMLIFrameElement;
  let iframeSrc = $state('');

  // Normalize URLs by removing trailing slashes
  function normalizeUrl(url: string): string {
    if (!url) return '';
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

  // Posts `{ handshake: true }` to the iframe every 300 ms until it answers.
  function handshake() {
    if (sync === false) {
      requestAnimationFrame(() => {
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage({ handshake: true });
        }
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
    if (!VALID_UPDATE.test(update)) {
      return console.warn(
        `Invalid update key: ${update} (expected an API path such as /blog-posts/123)`
      );
    }

    if (!panelContexts[update]) {
      // The key's own locale stays
      const res = await fetch(withLocale(`${API_PREFIX}${update}`, locale.code));
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

    // The page answered the handshake with its URL: in sync once it is the one asked for
    if (e.data.handshake) {
      iframeSrc = e.data.handshake;
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
    window.addEventListener('message', onIframeMessage);
  });

  $effect(() => {
    // Check whether the iframe src has a 200 status code and is reachable
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
    }
  });

  function closeActivePanel() {
    if (activePanel) {
      panelStack = panelStack.slice(0, -1);
    } else {
      backToDocumentPanel();
    }
  }

  // A collection document goes back to its page, an area to the area page.
  function backToDocumentPanel() {
    const kebab = toKebabCase(data.slug);
    const isCollection = data.doc._prototype === 'collection';
    return goto(isCollection ? panelPath(kebab, data.doc.id) : panelPath(kebab));
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

<Commands>
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
</Commands>

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
    background-color: var(--rz-bg-page);
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
    background-color: var(--rz-bg-overlay);
    backdrop-filter: blur(var(--rz-overlay-blur));
    color: var(--rz-fg);
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
