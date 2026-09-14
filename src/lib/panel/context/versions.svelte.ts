import { getContext, setContext } from 'svelte';

/**
 * The version history's state, shared between the document page that shows it, the settings
 * menu that opens it, and the form that says which row it is on.
 *
 * The page sets it outside the block that remounts the document on every version, so picking a
 * version keeps the history open. `versionId` follows the form rather than the page data: an
 * auto-save moves the form onto a new row without a load.
 */
function createVersionsStore() {
  let open = $state(false);
  let versionId = $state<string>();

  return {
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
