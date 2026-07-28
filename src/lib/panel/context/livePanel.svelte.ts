import { getContext, setContext } from 'svelte';

const KEY = Symbol('rime.live-panel');

export type ActivePanel = {
  key: string;
  update: string;
  fieldPath: string;
  position: 'sidebar' | 'floating';
};

export type LivePanelStore = {
  readonly activePanel: ActivePanel | null;
  readonly panelStack: ActivePanel[];
};

export function setLivePanelContext(store: LivePanelStore) {
  return setContext(KEY, store);
}

export function getLivePanelContext(): LivePanelStore {
  return getContext<LivePanelStore>(KEY);
}
