import type { PanelConfig } from '$lib/core/config/types.js';
import type { Dic } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';
import { defineFeature } from '../define.js';
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
 * (`handlers/auth.server.ts`), which defaults it to an `isAdmin` check itself.
 */
export const panel = defineFeature({
  name: 'panel',
  type: 'augment',
  requires: ['auth'],
  enabled: () => true,

  configure: (config) => augmentPanel(augmentIcons(config))
});

/**
 * Both halves of the panel's config: the icon map, and `panel` with its defaults filled in.
 *
 * The four members `augmentPanel` always writes are declared **required**, which is the point of
 * defaulting them: `boot.server.ts` reads `panel.language` and `panel/navigation.ts` reads
 * `panel.routes`, and both are optional on `PanelConfig` as an author writes it.
 */
declare module '$lib/core/features/register.js' {
  interface FeatureConfigure<T> {
    panel: T & {
      icons: Dic<Component<IconProps>>;
      panel: PanelConfig &
        Required<Pick<PanelConfig, 'routes' | 'language' | 'navigation' | 'components'>>;
    };
  }
}
