<script lang="ts" generics="T">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { getLiveContext } from '$lib/panel/context/live.svelte.js';
  import { normalizeFieldPath } from '$lib/util/doc.js';
  import { onDestroy, type Snippet } from 'svelte';

  type Props = {
    data: T;
    path?: string;
    update?: string;
    position?: 'sidebar' | 'floating';
    child: Snippet<[value: T, props: PanelProps]>;
  };

  type PanelProps = {
    onclick?: null | ((e: MouseEvent) => void);
    role?: 'button' | null;
    tabindex?: 0 | null;
    'data-live-panel-trigger'?: '' | null;
    'data-is-active'?: '' | null;
  };

  const { data, path = '', update: incomingUpdate, position = 'sidebar', child }: Props = $props();

  const live = getLiveContext();

  // Fallback to doc api url if prop not present
  const update = $derived(incomingUpdate ? incomingUpdate : live.documentUpdateURI);

  $effect(() => {
    if (path === '') {
      window.top?.postMessage({
        activatePanel: { key, path, update, fieldPath: path, position: position }
      });
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

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      window.top?.postMessage({
        deactivatePanel: { key }
      });
    }
  }

  function activate() {
    if (!live?.enabled) return;
    window.top?.postMessage({
      activatePanel: { key, path, update, fieldPath: path, position: position }
    });
    window.addEventListener('keydown', onKeyDown);
  }

  onDestroy(() => {
    if (browser) window.removeEventListener('keydown', onKeyDown);
  });

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
    outline-offset: 5px;
    outline: 2px solid var(--rz-color-live-panel-spot);
  }
</style>
