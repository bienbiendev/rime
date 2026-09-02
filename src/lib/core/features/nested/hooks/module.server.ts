import { addChildrenProperty } from './add-children.server.js';

/**
 * What nested contributes to the document pipeline — one read hook, populating `_children`.
 *
 * A module of its own, with no `module.ts` beside it, and that is the convention's rule rather
 * than a preference: when a pair has both halves, `$rime/modules` exports the client half's names
 * on a client build, so a name only the server half declares is simply missing there. Only a
 * module with *no* client half gets its names stubbed to `undefined`. So a symmetric export
 * (`augmentNested`) belongs in the pair, and a server-only one belongs here.
 */
export const nestedHooks = {
  beforeRead: [addChildrenProperty]
};
