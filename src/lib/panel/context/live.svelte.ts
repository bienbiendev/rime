import { apiUrl } from '$lib/core/api/index.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import { toKebabCase } from '$lib/util/string.js';
import type { BeforeNavigate } from '@sveltejs/kit';
import { getContext, setContext } from 'svelte';
import { isObjectLiteral, setValueAtPath } from '../../util/object.js';

const LIVE_KEY = Symbol('rime.live');

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

type OnDataCallback = (args: { path: string; value: any }) => void;
type LiveStore<T extends GenericDoc = GenericDoc> = ReturnType<typeof createStore<T>>;

function createStore<T extends GenericDoc = GenericDoc>(href: string) {
  let enabled = $state(false);
  let doc = $state<T>();
  const callbacks: OnDataCallback[] = [];
  let currentFocusedElement = $state<HTMLElement>();

  /**
   * Handles navigation within iframe to maintain live editing mode
   */
  const beforeNavigate = (params: BeforeNavigate) => {
    if (window && window.top && params.to?.url.href && enabled) {
      // Send navigation message to parent with live=1 param
      window.top.postMessage({ location: params.to.url.href + '?live=1' });
      params.cancel();
    }
  };

  /**
   * Processes messages from parent window
   */
  const onMessage = async (e: any) => {
    // Handle handshake request
    if (e.data.handshake) {
      enabled = true;
      if (window && window.top) {
        // Send handshake response with current URL
        window.top.postMessage({ handshake: href });
      }
    }
    // Handle field updates
    else if (e.data.path && e.data.value !== undefined) {
      await handleFieldUpdate(e.data);
    }
    // Handle focus requests
    else if (e.data.focus && typeof e.data.focus === 'string' && typeof document !== 'undefined') {
      handleFocusField(e.data.focus);
    }
  };

  /**
   * Recursively processes relation objects in any data structure
   */
  const populate = async (value: any): Promise<any> => {
    // Base case: null or undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Check if it's a resource link field value
    if (
      isObjectLiteral(value) &&
      'value' in value &&
      'target' in value &&
      'type' in value &&
      !['url', 'email', 'tel', 'anchor'].includes(value.type)
    ) {
      if (value.type && value.value) {
        try {
          const { type, value: id } = value;
          const response = await fetch(`${apiUrl(toKebabCase(type), id)}?depth=1`).then((r) =>
            r.json()
          );

          if (response && response.doc && response.doc.url) {
            return {
              ...value,
              url: response.doc.url
            };
          }
        } catch (err) {
          console.error(err);
          return value;
        }
      }

      return value;
    }

    // Check if it's a relation object
    if (isObjectLiteral(value) && 'documentId' in value && 'relationTo' in value) {
      // Process single relation object
      if ('livePreview' in value) {
        return value.livePreview;
      } else {
        try {
          const response = await fetch(
            `${apiUrl(toKebabCase(value.relationTo), value.documentId)}?depth=1`
          ).then((r) => r.json());

          if (response && response.doc) {
            return response.doc;
          }
        } catch (err) {
          console.error(err);
        }
      }
      return value;
    }

    // Process arrays
    if (Array.isArray(value)) {
      const result = [...value];
      for (let i = 0; i < result.length; i++) {
        result[i] = await populate(result[i]);
      }
      return result;
    }

    // Process objects (recursively)
    if (isObjectLiteral(value)) {
      const result = { ...value };
      for (const key of Object.keys(result)) {
        result[key] = await populate(result[key]);
      }
      return result;
    }

    // Return primitives as is
    return value;
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

  /**
   * Handles focusing a specific field in the UI
   */
  const handleFocusField = (focusPath: string) => {
    const element = document.querySelector<HTMLElement>(`[data-field="${focusPath}"]`);
    if (element) {
      const ringStyle = '0px 0px 0px 1px red';

      // Scroll to the element
      element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });

      // Add highlight style
      element.style.boxShadow = ringStyle;
      if (currentFocusedElement) {
        currentFocusedElement.style.boxShadow = '';
      }
      currentFocusedElement = element;
    }
  };

  /**
   * Registers a callback for data changes
   */
  const onData = (callback: OnDataCallback) => {
    callbacks.push(callback);
  };

  // Return public facade
  return {
    beforeNavigate,
    onMessage,
    onData,

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
