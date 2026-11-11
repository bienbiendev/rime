import type { Attachment } from 'svelte/attachments';

/** The levels of the modals open now. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read once per opening, never tracked
const taken = new Set<number>();

/**
 * One modal's level among the open modals, read by its overlay and its content as
 * `--rz-modal-level`. The first open modal is at 0, and each next one goes one above the highest,
 * so the modal opened last is drawn on top, as bits-ui ranks it for Escape, outside clicks and
 * the focus.
 *
 * ```ts
 * // a sheet opens               → 0
 * // the palette opens over it   → 1
 * // the sheet closes            → the palette keeps 1
 * // a dialog opens              → 2
 * ```
 *
 * `raise` goes on the content: it takes the level as the content mounts and gives it back once
 * the content is gone. bits-ui keeps the content mounted through its exit animation, so a sheet
 * sliding out keeps its level, and a modal opened meanwhile goes above it.
 */
export function createLayer() {
  let level = $state(0);

  const raise: Attachment = () => {
    const mine = taken.size ? Math.max(...taken) + 1 : 0;
    taken.add(mine);
    level = mine;
    return () => {
      taken.delete(mine);
    };
  };

  return {
    raise,
    get level() {
      return level;
    }
  };
}
