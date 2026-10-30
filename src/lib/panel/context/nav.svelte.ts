import { readStored, writeStored } from '#lib/panel/util/storage.js';
import { getContext, setContext } from 'svelte';

const NAV_CTX = 'rime.nav';

const STORAGE_KEY = 'rz-panel-collapsed';
/** Under this width the navigation is folded whatever was chosen. */
const NARROW_PX = 1024;

/**
 * The panel's navigation: folded or not, and how wide, for whatever lines up with its edge.
 *
 * Folded is the user's choice, kept in the browser across visits, open until they fold it. A
 * narrow window folds it regardless, and gives the choice back when it widens.
 */
export function setNavContext() {
  /** The user's choice, kept across visits; null until they make one. */
  const stored = readStored(STORAGE_KEY);
  let chosen: boolean | null = stored === null ? null : stored === 'true';

  /** The window's width decides first, the choice second, open by default. */
  const fitted = () => (window.innerWidth < NARROW_PX ? true : (chosen ?? false));
  let collapsed = $state(fitted());

  function setCollapsed(value: boolean) {
    collapsed = value;
    chosen = value;
    writeStored(STORAGE_KEY, String(value));
  }

  $effect(() => {
    const fit = () => (collapsed = fitted());
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  const store = {
    get collapsed() {
      return collapsed;
    },
    /** A CSS length: the navigation's width as it stands. */
    get width() {
      return collapsed ? 'var(--rz-size-12)' : 'var(--rz-size-60)';
    },
    setCollapsed,
    toggle: () => setCollapsed(!collapsed)
  };

  return setContext(NAV_CTX, store);
}

type NavStore = ReturnType<typeof setNavContext>;

/** The navigation, or nothing on a page without one: the live edit page. */
export const getNavContext = () => getContext<NavStore | undefined>(NAV_CTX);
