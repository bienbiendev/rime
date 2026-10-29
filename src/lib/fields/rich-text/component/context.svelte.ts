/** One editor's shared state: whether its bubble menu is open, which the link form reads. */
export function createRichTextState() {
  let bubbleOpen = $state(false);

  return {
    get bubbleOpen() {
      return bubbleOpen;
    },
    set bubbleOpen(v: boolean) {
      bubbleOpen = v;
    }
  };
}

export type RichTextContext = ReturnType<typeof createRichTextState>;
