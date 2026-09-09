import { defineFeature } from '$lib/core/features/define.js';
import { augmentPanel } from './augment.js';
import { augmentIcons } from './icons.js';

/**
 * What every config needs before a panel can render it: the slug → icon map, and `panel` itself
 * with its navigation groups, language and header components filled in.
 *
 * `configure` only — a statement about the whole config. There is no `augment`, so nothing here
 * touches a prototype's fields and listing it cannot move a column.
 *
 * The panel is a **consumer** of rime, so this feature is a place for the config defaults it needs
 * rather than a decoupling of it: what is left to fix is core reaching back into `src/lib/panel/`,
 * not the panel reaching into core. Nor will the panel become prototype-agnostic — listing many
 * documents and editing an area's single one are different screens — the aim is only that the
 * branch between them is the panel's own.
 *
 * **Listed before `upload` and `versions`, deliberately.** Those two derive collections, and the
 * icon map covers what exists when it runs; first keeps derived collections out of it.
 * `requires: ['auth']` is the other half — the `staff` collection has to be there to get an icon.
 *
 * Who may open the panel is not here: `panel.$access` has one reader
 * (`features/auth/handler/index.server.ts`), which defaults it to an `isAdmin` check itself.
 */
export const panel = defineFeature({
  name: 'panel',
  enabled: () => true,

  configure: (config) => augmentPanel(augmentIcons(config))
});
