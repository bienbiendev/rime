import { page } from '$app/state';
import { env } from '$env/dynamic/public';
import { PARAMS } from '$lib/core/constants.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { BeforeNavigate } from '@sveltejs/kit';
import { getContext, setContext } from 'svelte';
import { getValueAtPath, setValueAtPath } from '../../util/object.js';
import { populate } from '../util/populate.js';

export const LIVE_KEY = Symbol('rime.live');

/**
 * Live Editing Flow:
 * 1. Live.svelte sends handshake message to iframe
 * 2. Live context in iframe receives it, enables itself
 * 3. Live context sends handshake response with its href
 * 4. Live.svelte receives the handshake response
 * 5. Live.svelte compares iframe href to expected iframeSrc
 * 6. If they match, sync is established and user can edit
 * 7. When navigating, iframe context sends message to parent with new location + ?live=1
 * 8. Live.svelte navigates to new location, maintaining live edit mode
 */

type LiveStore<T extends GenericDoc = GenericDoc> = ReturnType<typeof createStore<T>>;

function createStore<T extends GenericDoc = GenericDoc>(href: string) {
  let enabled = $state(false);
  let doc = $state<T>();
  const liveStore = $state<Record<string, any>>({});
  let activePanelKey = $state<string | null>(null);
  const origin = new URL(env.PUBLIC_RIME_URL).origin;

  /**
   * Handles navigation within iframe to maintain live editing mode
   */
  const beforeNavigate = (params: BeforeNavigate) => {
    if (params.type === 'leave') return;
    const url = params.to?.url.href;
    if (window && window.top && url && enabled) {
      window.top.postMessage({ location: url + '?live=1' });
      params.cancel();
    }
  };

  /**
   * Processes messages from parent window
   */
  const onMessage = async (e: MessageEvent) => {
    // Only accept messages from the trusted panel origin
    if (e.origin !== origin) return;

    // Handle handshake request
    if (e.data.handshake) {
      enabled = true;
      if (window && window.top) {
        // Send handshake response with current URL
        window.top.postMessage({ handshake: href });
      }
    }

    // Handle panel store updates (new protocol — has `update` key)
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
    // Handle field updates (legacy single-doc protocol)
    else if (e.data.path && e.data.value !== undefined) {
      await handleFieldUpdate(e.data);
    }
  };

  /**
   * Handles panel store updates (new multi-panel protocol)
   */
  const handlePanelUpdate = async (data: { update: string; path: string; value: any }) => {
    const processedValue = await populate(data.value);
    if (!data.path) {
      // Empty path = full doc seed (sent on panel activation)
      liveStore[data.update] = processedValue;
      return;
    }
    const current = liveStore[data.update] ?? {};
    liveStore[data.update] = setValueAtPath(data.path, current, processedValue);
  };

  /**
   * Handles field value updates
   */
  const handleFieldUpdate = async (data: { path: string; value: any }) => {
    if (!doc) throw new Error('live.doc has not been set before handleFieldUpdate');
    // Populate relations / link
    const processedValue = await populate(data.value);
    // Update the document
    doc = setValueAtPath(data.path, doc, processedValue) as T;
  };

  // Return public facade
  return {
    beforeNavigate,
    onMessage,

    get documentUpdateURI() {
      const doc = page.data.doc;
      if (!doc)
        throw new Error(
          'live.doc has not been set before accessing documentAPIUpdateURL, be sure to provide a "doc" property in the page data, or provide an update property to the LiveEdit component.'
        );
      let uri = `/${doc._type}`;
      if (doc._prototype === 'collection') uri += `/${doc.id}`;
      const params = [];
      if (doc.versionId) params.push(`${PARAMS.VERSION_ID}=${doc.versionId}`);
      if (doc.locale) params.push(`${PARAMS.LOCALE}=${doc.locale}`);
      if (params.length) uri += `?${params.join('&')}`;
      return uri;
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

    get data() {
      return { doc };
    },

    get doc() {
      return doc;
    },

    set doc(value) {
      doc = value;
    },

    get enabled() {
      return enabled;
    }
  };
}

/**
 * Creates and sets the live context for the current component
 */
export function setLiveContext<T extends GenericDoc = GenericDoc>(href: string) {
  const store = createStore<T>(href);
  setContext(LIVE_KEY, store);
  return store;
}

/**
 * Gets the live context from the current component
 */
export function getLiveContext<T extends GenericDoc = GenericDoc>() {
  return getContext<LiveStore<T>>(LIVE_KEY);
}
