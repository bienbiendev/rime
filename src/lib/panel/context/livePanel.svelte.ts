import { getContext, setContext } from 'svelte';

const KEY = Symbol('rime.live-panel');

export type ActivePanel = {
  /** The LivePanel's own key in the page. */
  key: string;
  /** The document's API path without `/api`, `/pages/123?locale=fr`: Live.svelte reads it there. */
  update: string;
  /** The field the panel opens on, `''` for the whole document. */
  fieldPath: string;
};

export type LivePanelStore = {
  readonly activePanel: ActivePanel | null;
};

export function setLivePanelContext(store: LivePanelStore) {
  return setContext(KEY, store);
}

export function getLivePanelContext(): LivePanelStore {
  return getContext<LivePanelStore>(KEY);
}
