<script lang="ts">
  import type { TextAreaFieldBuilder } from '$lib/fields/textarea/index.js';
  import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
  import { capitalize } from '$lib/util/string.js';
  import type { TextFieldBuilder } from '../index.js';

  type Props = {
    path: string;
    config: TextFieldBuilder | TextAreaFieldBuilder;
    form: DocumentFormContext;
    /** The element drawn: `h2`, `p`… `span` by default. */
    as?: string;
    class?: string;
  };
  const { path, config, form, as = 'span', class: className }: Props = $props();

  const field = $derived(form.useField<string>(path, config));
  /** A textarea keeps its lines; a text is one. */
  const multiline = $derived(config.type === 'textarea');
  let element = $state<HTMLElement>();

  // The value goes into the element only when it differs from what the element shows: the caret
  // stays where it is while typing, and a change made in the inspector shows here. The element
  // has no children of Svelte's to lose.
  $effect(() => {
    const value = field.value ?? '';
    // eslint-disable-next-line svelte/no-dom-manipulating
    if (element && element.textContent !== value) element.textContent = value;
  });

  function oninput() {
    if (!element) return;
    // Emptied, the element keeps no stray line break, so its placeholder shows again.
    // eslint-disable-next-line svelte/no-dom-manipulating
    if (!element.textContent) element.replaceChildren();
    field.value = element.textContent ?? '';
  }

  /** In a text, Enter adds nothing. */
  function onkeydown(event: KeyboardEvent) {
    if (!multiline && event.key === 'Enter') event.preventDefault();
  }

  /** Pasted into a text, line breaks become spaces. */
  function onpaste(event: ClipboardEvent) {
    if (multiline) return;
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s*\r?\n\s*/g, ' ');
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    oninput();
  }
</script>

<!-- A text edited where a block render draws it: the render's own element, its tag and its class. -->
<svelte:element
  this={as}
  bind:this={element}
  class="rz-text-inline {className ?? ''}"
  contenteditable={field.editable ? 'plaintext-only' : 'false'}
  role="textbox"
  tabindex="0"
  aria-multiline={multiline}
  aria-label={config.get.label || capitalize(config.name)}
  data-multiline={multiline ? '' : null}
  data-placeholder={config.get.placeholder || capitalize(config.name)}
  data-error={field.error ? '' : null}
  {oninput}
  {onkeydown}
  {onpaste}
></svelte:element>

<style lang="postcss">
  @import '../../../panel/style/mixins/index.css';

  /* The render's own text: no frame of its own while edited, as a rich text in place. */
  .rz-text-inline {
    border-radius: var(--rz-radius-sm);
    outline: none;
    cursor: text;

    &[data-multiline] {
      white-space: pre-wrap;
    }
    &[data-error] {
      outline: 1px solid var(--rz-danger);
      outline-offset: 2px;
    }
    &:empty::before {
      content: attr(data-placeholder);
      color: var(--rz-fg-subtle);
      pointer-events: none;
    }
  }
</style>
