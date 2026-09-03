import type { PanelConfig } from '$lib/core/factory/config/types.js';
import { Book, BookCopy, BookType, SlidersVertical } from '@lucide/svelte';

/**
 * The panel's own config defaults: navigation groups, language, header components.
 *
 * The panel was never part of the prototype/feature restructure, but its three config augments
 * were sitting in `core/config/` — core defaulting somebody else's surface. They live with the
 * panel now, which is the start of it becoming a feature proper.
 *
 * Why there is no `defineFeature` here yet: a feature's whole-config step is `configure`, and
 * `configureWithFeatures` returns the config's type unchanged — deliberately, since the prototype
 * registry it reads is annotated to keep every hook out of `BuildConfig`'s loop (see
 * prototype/registry.ts). These three *refine* the type: drop their narrowing and `config.panel`
 * is possibly-undefined in boot.server.ts, panel/navigation.ts and handlers/auth.server.ts. So
 * they stay typed steps in the config chain, called from build{,.server}.ts — exactly as the auth
 * feature's `augmentStaff` is, and for the same reason.
 */
export const augmentPanel = <const T extends { panel?: Omit<PanelConfig, '$access'> }>(
  config: T
) => {
  //
  const panelNavigationGroups = [
    ...(config.panel?.navigation?.groups || []),
    { label: 'content', icon: BookType },
    { label: 'system', icon: SlidersVertical },
    { label: 'collections', icon: BookCopy },
    { label: 'areas', icon: Book }
  ] as const;

  const panel = {
    ...config.panel,
    routes: config.panel?.routes ? config.panel.routes : {},
    language: config.panel?.language || 'en',
    navigation: { groups: panelNavigationGroups },
    components: {
      header: config.panel?.components?.header || [],
      ...(config.panel?.components?.dashboard && { dashboard: config.panel.components.dashboard })
    }
  } as const;

  return { ...config, panel } as const;
};
