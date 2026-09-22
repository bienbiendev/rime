/** A key chord: `mod` is ⌘ on a Mac, Ctrl elsewhere; `key` is `event.key` in lower case. */
export type Keys = { mod: boolean; shift: boolean; alt: boolean; key: string };

/**
 * `alt+arrowup` -> `{ alt: true, key: 'arrowup' }`. The last part is the key, the others the
 * modifiers, in any order.
 */
export function parseKeys(keys: string): Keys {
  const parts = keys.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key
  };
}

/** The event is exactly this chord: every modifier named, no other one down. */
export function matches(event: KeyboardEvent, keys: Keys): boolean {
  return (
    keys.mod === (event.metaKey || event.ctrlKey) &&
    keys.shift === event.shiftKey &&
    keys.alt === event.altKey &&
    keys.key === event.key.toLowerCase()
  );
}

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const KEY_LABELS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
  enter: '↵'
};

/** `mod+s` -> `⌘S` on a Mac, `Ctrl+S` elsewhere. */
export function formatKeys(keys: string, mac = isMac()): string {
  const parsed = parseKeys(keys);
  const parts: string[] = [];
  if (parsed.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (parsed.alt) parts.push(mac ? '⌥' : 'Alt');
  if (parsed.shift) parts.push(mac ? '⇧' : 'Shift');
  parts.push(KEY_LABELS[parsed.key] ?? parsed.key.toUpperCase());
  return parts.join(mac ? '' : '+');
}

/** The keyboard is a field's: an input, a textarea, a select, a contenteditable, an editor. */
export function isTyping(event: Event): boolean {
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable || !!target.closest('.ProseMirror');
}
