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
 * The panel is the part of the repo the restructure has not reached, and this is the start of it.
 * Its three augments used to sit in `core/config/`, called by name from the chain — core holding
 * the panel's defaults for it, and naming a feature to do it.
 *
 * `enabled` is unconditional and there is no `augment`: nothing here touches a prototype's fields
 * (which is why adding this to the `features` lists cannot move a column). It is `configure`
 * only — a statement about the whole config.
 *
 * **Listed before `upload` and `versions`, deliberately.** Those two derive collections, and the
 * icon map is built from what exists when it runs; keeping this first keeps a derived collection
 * out of it, which is what the config chain did. `requires: ['auth']` is the other half: the
 * `staff` collection has to be there to get an icon.
 *
 * The third augment is gone rather than moved. `augmentPanelAccess` defaulted `panel.$access` to
 * an `isAdmin` check — server-only, type-refining, for a member with exactly one reader. That
 * reader (`handlers/auth.server.ts`) defaults it itself now.
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
 * The four members `augmentPanel` always writes are declared **required** here, because that is
 * the point of defaulting them — `boot.server.ts` reads `panel.language` and `panel/navigation.ts`
 * reads `panel.routes`, and both are optional on `PanelConfig` as an author writes it.
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
