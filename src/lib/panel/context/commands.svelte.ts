import { isTyping, matches, parseKeys } from '$lib/panel/util/keys.js';
import type { IconProps } from '@lucide/svelte';
import { getContext, setContext, type Component } from 'svelte';

/** One thing the user can do where they are: a palette line, a key, or both. */
export type Command = {
  /** `document.save`, `blocks.duplicate`, `text.bold` */
  id: string;
  label: string;
  /** The palette's heading: `Document`, `Block`, `Add`, `Go to`, `Text` */
  group?: string;
  /** On the palette line, before the label. */
  icon?: Component<IconProps>;
  /** `mod+s`, `alt+arrowup`, `backspace`, `/`. `mod` is ⌘ on a Mac, Ctrl elsewhere. */
  keys?: string;
  /** Fires while a field has the keyboard. Off, the field keeps the key. */
  inField?: boolean;
  /** Keys only, not a palette line: the arrows. */
  hidden?: boolean;
  /** Offered right now. A command that is not is skipped, keys and palette alike. */
  when?: () => boolean;
  /** From a key, the event; from the palette, nothing. */
  run: (event?: KeyboardEvent) => unknown;
};

/**
 * The commands a mounted component offers, read when a key comes or the palette opens. `depth`
 * is how many scopes it sits inside; `order` breaks a tie, the latest mounted first.
 */
type Scope = { get: () => Command[]; depth: number; order: number };

const KEY = Symbol('rime.commands');
const DEPTH = Symbol('rime.commands.depth');

/**
 * One dispatcher for every key of the panel, and one palette. Components nest their scopes; a key
 * goes to the innermost scope that claims it, and the palette lists them all, the innermost
 * first, so what the page offers comes before what the panel offers.
 */
export function setCommandsContext() {
  // Read on a key and when the palette opens, never by a derived: a plain array, so registering
  // from an effect does not re-run that effect.
  let scopes: Scope[] = [];
  let open = $state(false);
  let query = $state('');
  let group = $state<string | null>(null);
  let listed = $state.raw<Command[]>([]);
  let mounted = 0;

  function register(scope: Omit<Scope, 'order'>) {
    const entry = { ...scope, order: mounted++ };
    scopes = [...scopes, entry];
    return () => {
      scopes = scopes.filter((candidate) => candidate !== entry);
    };
  }

  /** What is offered right now, innermost scope first. */
  function available(): Command[] {
    return scopes
      .toSorted((a, b) => b.depth - a.depth || b.order - a.order)
      .flatMap((scope) => scope.get())
      .filter((command) => !command.when || command.when());
  }

  function dispatch(event: KeyboardEvent) {
    const typing = isTyping(event);
    for (const command of available()) {
      if (!command.keys || !matches(event, parseKeys(command.keys))) continue;
      if (typing && !command.inField) continue;
      event.preventDefault();
      command.run(event);
      return;
    }
  }

  const palette = {
    get open() {
      return open;
    },
    set open(value: boolean) {
      open = value;
      if (!value) group = null;
    },
    get query() {
      return query;
    },
    set query(value: string) {
      query = value;
    },
    get group() {
      return group;
    },
    /** The commands on offer when the palette opened; the dialog takes the focus, they stay. */
    get commands() {
      return listed;
    },
    show(options: { group?: string } = {}) {
      listed = available().filter((command) => !command.hidden);
      group = options.group ?? null;
      query = '';
      open = true;
    },
    toggle() {
      if (open) palette.open = false;
      else palette.show();
    }
  };

  return setContext(KEY, { register, dispatch, palette });
}

export type CommandsContext = ReturnType<typeof setCommandsContext>;

export function getCommandsContext() {
  return getContext<CommandsContext | undefined>(KEY);
}

/**
 * The commands a component offers while it is mounted. Outside the panel, nothing listens.
 *
 * Its depth is one more than the scope it sits in, and the components under it sit one deeper:
 *
 *   Document 1 > BlocksFocus 2 > RichText 3
 *
 * `depth: 0` puts it with the panel's own, below every page: the language, the navigation.
 */
export function useCommands(get: () => Command[], options: { depth?: number } = {}) {
  const commands = getCommandsContext();
  if (!commands) return;
  let depth = options.depth;
  if (depth === undefined) {
    depth = (getContext<number>(DEPTH) ?? 0) + 1;
    setContext(DEPTH, depth);
  }
  const scope = { get, depth };
  $effect(() => commands.register(scope));
}
