<script lang="ts" generics="T">
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { getLiveContext } from './context.svelte.js';
  import { normalizeFieldPath } from '#lib/util/string.js';
  import { onDestroy, type Snippet } from 'svelte';

  type Props = {
    /** The value shown until the panel sends one. Without it: the page's whole `data.doc`. */
    data?: T;
    /** Full path to the field being edited from the root of the document, e.g. `attributes.title` or `layout.sections.2:paragraph.text` */
    path?: string;
    /** API path of the document, without `/api`: `/pages/123`, `/blog-posts/456` */
    update?: string;
    child: Snippet<[value: T, props: PanelProps]>;
  };

  type PanelProps = {
    onclick?: null | ((e: MouseEvent) => void);
    onkeydown?: null | ((e: KeyboardEvent) => void);
    role?: 'button' | null;
    tabindex?: 0 | null;
    'data-live-panel-trigger'?: '' | null;
    'data-is-active'?: '' | null;
  };

  const { data: incomingData, path = '', update: incomingUpdate, child }: Props = $props();

  const data = $derived(incomingData ?? page.data.doc);
  const live = getLiveContext();

  // The update URI: the prop, else the page document's own
  const update = $derived(incomingUpdate || live?.documentUpdateURI);

  // A LiveEdit for the whole document opens its panel once the page is in live view
  $effect(() => {
    if (path === '' && live?.enabled) {
      window.top?.postMessage({ activatePanel: { key, path, update, fieldPath: path } });
    }
  });

  // Unique key for this panel instance — discriminates panels with same update but different path
  const key = $derived(`${path}-${update}`);

  // Strip :blockType suffix from path segments for store lookup
  // e.g. 'layout.sections.2:paragraph' → reads liveStore at 'layout.sections.2'
  const lookupPath = $derived(normalizeFieldPath(path));

  // Read from live store, fall back to data prop
  const liveValue = $derived(live?.getPanelValue(update, lookupPath));
  const value = $derived(liveValue ?? data);
  const isActive = $derived(live?.activePanelKey === key);

  /** Escape closes this panel and goes back to the one under it. */
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      window.top?.postMessage({
        deactivatePanel: { key }
      });
    }
  }

  /** Opens this panel in the live view, and listens for Escape. Nothing outside live view. */
  function activate() {
    if (!live?.enabled) return;
    window.top?.postMessage({
      activatePanel: { key, path, update, fieldPath: path }
    });
    window.addEventListener('keydown', onKeyDown);
  }

  onDestroy(() => {
    if (browser) window.removeEventListener('keydown', onKeyDown);
  });

  /**
   * The props of the element `child` renders: for a signed-in user in live view, a trigger that
   * opens this panel, inert while it is open; an empty object for everyone else.
   */
  function makeChildProps(): PanelProps {
    if (!page.data.user || !live?.enabled) return {};

    return {
      onclick: !isActive
        ? (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            activate();
          }
        : null,
      // Enter and Space open the panel, as a click does
      onkeydown: !isActive
        ? (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.stopPropagation();
            e.preventDefault();
            activate();
          }
        : null,
      role: isActive ? null : 'button',
      tabindex: isActive ? null : 0,
      'data-live-panel-trigger': '',
      'data-is-active': isActive ? '' : null
    };
  }
</script>

{@render child(value, makeChildProps())}

<style>
  :root {
    --rz-color-live-panel-spot: hsl(240deg 89% 60%);
  }

  :global([data-live-panel-trigger]) {
    outline: none;
  }

  :global([data-live-panel-trigger]:not([data-is-active]):hover) {
    outline: 1px dashed hsl(from var(--rz-color-live-panel-spot) h s l / 0.6);
    outline-offset: 5px;
    cursor: pointer;
  }

  :global([data-live-panel-trigger][data-is-active]) {
    outline-offset: -2px;
    outline: 2px solid var(--rz-color-live-panel-spot);
  }
</style>
