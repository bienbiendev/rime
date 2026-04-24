import { getContext } from 'svelte';
import createContext from './createContext.svelte';

export const TITLE_CTX = 'rime.document.title';

export function getTitleContext() {
  return getContext<{ value: string }>(TITLE_CTX);
}

export function setTitleContext(title: string) {
  return createContext(TITLE_CTX, title);
}
