import type { Editor } from '@tiptap/core';
import { getContext, setContext } from 'svelte';

function createRichTextState() {
  let bubbleOpen = $state(false);
  let suggestionOpen = $state(false);
  let editor: Editor | null = null;

  return {
    get editor() {
      return editor;
    },
    set editor(v: Editor | null) {
      editor = v;
    },
    get bubbleOpen() {
      return bubbleOpen;
    },
    set bubbleOpen(v: boolean) {
      bubbleOpen = v;
    },
    get suggestionOpen() {
      return suggestionOpen;
    },
    set suggestionOpen(v: boolean) {
      suggestionOpen = v;
    }
  };
}

export function setRichTextContext(key: string) {
  const state = createRichTextState();
  return setContext(key, state);
}

export function getRichTextContext(key: string) {
  return getContext<ReturnType<typeof setRichTextContext>>(key);
}

export type RichTextContext = ReturnType<typeof getRichTextContext>;
