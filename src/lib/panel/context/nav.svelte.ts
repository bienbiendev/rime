import { getContext, setContext } from 'svelte';

export const NAV_CTX = 'rime.nav';

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
  let collapsed = $state(true);
  let chosen: boolean | null = null;

  function setCollapsed(value: boolean) {
    collapsed = value;
    chosen = value;
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // A browser without storage keeps the choice for the visit.
    }
  }

  /** The window's width decides first, the choice second, open by default. */
  function fit() {
    collapsed = window.innerWidth < NARROW_PX ? true : (chosen ?? false);
  }

  $effect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) chosen = stored === 'true';
    } catch {
      // No storage, no remembered choice.
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  const store = {
    get collapsed() {
      return collapsed;
    },
    /** A CSS length: the navigation's width as it stands. */
    get width() {
      return collapsed ? 'var(--rz-size-10)' : 'var(--rz-size-72)';
    },
    setCollapsed,
    toggle: () => setCollapsed(!collapsed)
  };

  return setContext(NAV_CTX, store);
}

export type NavStore = ReturnType<typeof setNavContext>;

/** The navigation, or nothing on a page without one: the live edit page. */
export const getNavContext = () => getContext<NavStore | undefined>(NAV_CTX);
