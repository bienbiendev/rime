import { getContext, setContext } from 'svelte';

/**
 * The version history's state, shared between the document page that shows it, the settings
 * menu that opens it, and the form that says which row it is on.
 *
 * The page sets it outside the block that remounts the document on every version, so picking a
 * version keeps the history open. `versionId` follows the form rather than the page data: an
 * auto-save moves the form onto a new row without a load.
 *
 * So the page data can still name the row the form left. When the row the form is on is deleted,
 * the page lands on a row it may already hold, and `rebuildForm()` rebuilds the form on it:
 *
 * ```ts
 * // opened at /panel/news/n1 (row p1), typing auto-saves row a1, then a1 is discarded
 * await goto('/panel/news/n1', { refreshAll: true }); // the page holds p1, as before
 * history.rebuildForm(); // the form shows p1, not what a1 held
 * ```
 */
function createVersionsStore() {
  let open = $state(false);
  let versionId = $state<string>();
  // Part of the key the page remounts the form on
  let stamp = $state(0);

  return {
    get stamp() {
      return stamp;
    },
    /** Rebuilds the form on the row the page holds. */
    rebuildForm() {
      stamp++;
    },
    get open() {
      return open;
    },
    set open(value: boolean) {
      open = value;
    },
    get versionId() {
      return versionId;
    },
    set versionId(value: string | undefined) {
      versionId = value;
    }
  };
}

const VERSIONS_CTX = Symbol('rime.versions');

export function setVersionsContext() {
  return setContext(VERSIONS_CTX, createVersionsStore());
}

export function getVersionsContext() {
  return getContext<ReturnType<typeof setVersionsContext> | undefined>(VERSIONS_CTX);
}
