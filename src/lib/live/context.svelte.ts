import { page } from '$app/state';
import { PARAMS } from '#lib/core/constants.js';
import { prototypeKebab } from '#lib/core/prototype/naming.js';
import type { GenericDoc } from '#lib/core/prototype/types.js';
import type { BeforeNavigate } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { getValueAtPath, setValueAtPath } from '#lib/util/object.js';
import { populate } from '#lib/fields/relation/populate.js';

export const LIVE_KEY = Symbol('rime.live');

/**
 * The panel's origin, the only one whose messages are read. `$app/env/public` loads with the
 * first message, so `rimecms/public` imports outside a SvelteKit page, in a component spec.
 */
let panelOrigin: Promise<string> | undefined;
const getPanelOrigin = () =>
  (panelOrigin ??= import('$app/env/public').then(({ SITE_URL }) => new URL(SITE_URL).origin));

/**
 * Live Editing Flow:
 * 1. Live.svelte sends handshake message to iframe
 * 2. Live context in iframe receives it, enables itself
 * 3. Live context sends handshake response with its href
 * 4. Live.svelte receives the handshake response
 * 5. Live.svelte compares the href the iframe sent (`iframeSrc`) to the expected `data.src`
 * 6. If they match, sync is established and user can edit
 * 7. When navigating, iframe context sends message to parent with new location + ?live=1
 * 8. Live.svelte navigates to new location, maintaining live edit mode
 */

type LiveStore = ReturnType<typeof createStore>;

/**
 * The API path the panel reads and saves a document through, without `/api`.
 *
 * ```ts
 * updateURI(doc); // '/pages/123?versionId=v1&locale=fr'
 * updateURI(blogPost); // '/blog-posts/456'
 * ```
 */
export const updateURI = (doc: GenericDoc) => {
  let uri = `/${prototypeKebab(doc._type)}`;
  if (doc._prototype === 'collection') uri += `/${doc.id}`;
  const params = [];
  if (doc.versionId) params.push(`${PARAMS.VERSION_ID}=${doc.versionId}`);
  if (doc.locale) params.push(`${PARAMS.LOCALE}=${doc.locale}`);
  if (params.length) uri += `?${params.join('&')}`;
  return uri;
};

function createStore(href: string) {
  let enabled = $state(false);
  const liveStore = $state<Record<string, any>>({});
  let activePanelKey = $state<string | null>(null);

  /**
   * Handles navigation within iframe to maintain live editing mode
   */
  const beforeNavigate = (params: BeforeNavigate) => {
    if (params.type === 'leave') return;
    if (!params.to || !window.top || !enabled) return;
    // The page's own query stays: `/news?page=2` → `/news?page=2&live=1`
    const location = new URL(params.to.url);
    location.searchParams.set('live', '1');
    window.top.postMessage({ location: location.href });
    params.cancel();
  };

  /**
   * Processes messages from parent window
   */
  const onMessage = async (e: MessageEvent) => {
    // Only accept messages from the trusted panel origin
    if (e.origin !== (await getPanelOrigin())) return;
    // The panel posts objects; anything else is another script's message
    if (typeof e.data !== 'object' || e.data === null) return;

    // Handle handshake request
    if (e.data.handshake) {
      enabled = true;
      if (window && window.top) {
        // Send handshake response with current URL
        window.top.postMessage({ handshake: href });
      }
    }

    // Handle panel store updates (messages with an `update` key)
    else if (
      e.data.update !== undefined &&
      e.data.path !== undefined &&
      e.data.value !== undefined
    ) {
      await handlePanelUpdate(e.data);
    }
    // Handle active panel notification from parent
    else if ('activePanel' in e.data) {
      activePanelKey = e.data.activePanel ?? null;
    }
  };

  /** The locale an update key names: `/pages/1?locale=fr` → `'fr'`, `/settings` → `undefined`. */
  const localeOf = (update: string) =>
    new URLSearchParams(update.split('?')[1] ?? '').get(PARAMS.LOCALE) ?? undefined;

  let queue: Promise<void> = Promise.resolve();

  /**
   * Writes a panel update into the store of its `update` key, one store per key. Updates apply
   * one at a time, in the order they arrive: each waits for the one before it to finish.
   */
  const handlePanelUpdate = (data: { update: string; path: string; value: any }) => {
    queue = queue.then(() => applyUpdate(data)).catch((error) => console.error(error));
    return queue;
  };

  /** Related documents are read in the key's locale. */
  const applyUpdate = async (data: { update: string; path: string; value: any }) => {
    const processedValue = await populate(data.value, localeOf(data.update));
    if (!data.path) {
      // Empty path = full doc seed (sent on panel activation)
      liveStore[data.update] = processedValue;
      return;
    }
    const current = liveStore[data.update] ?? {};
    liveStore[data.update] = setValueAtPath(data.path, current, processedValue);
  };

  // Return public facade
  return {
    beforeNavigate,
    onMessage,

    get documentUpdateURI() {
      const doc = page.data.doc;
      if (!doc) {
        throw new Error(
          'page.data.doc is missing: provide a "doc" in the page data, or an update property to the LiveEdit component.'
        );
      }
      return updateURI(doc);
    },

    getPanelValue: (update: string, path: string): any => {
      const entry = liveStore[update];
      if (!entry) {
        return undefined;
      }
      return getValueAtPath(path, entry);
    },

    get activePanelKey() {
      return activePanelKey;
    },

    get enabled() {
      return enabled;
    }
  };
}

/**
 * Creates and sets the live context for the current component
 */
export function setLiveContext(href: string) {
  const store = createStore(href);
  setContext(LIVE_KEY, store);
  return store;
}

/**
 * Gets the live context from the current component
 */
export function getLiveContext() {
  return getContext<LiveStore>(LIVE_KEY);
}
