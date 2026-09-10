import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Component } from 'svelte';
import type { Dic } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { PanelConfig } from '$lib/core/panel/types.js';
import { Book, BookCopy, BookType, SlidersVertical } from '@lucide/svelte';

/**
 * The slug → icon map the panel navigates by, gathered from every prototype config.
 *
 * A feature-derived collection (upload's `<slug>Directories`, versions' aliases) has no entry:
 * `panel` is listed before `upload` and `versions`, so they do not exist yet when this runs. That
 * is the behaviour the chain had before the panel became a feature, and the feature list is where
 * it is now declared — see index.ts.
 */
const withIcons = <const T extends { collections?: BuiltCollection[]; areas?: BuiltArea[] }>(
  config: T
) => {
  const icons: Dic<Component<IconProps>> = {};

  // Add icons
  for (const collection of config.collections || []) {
    icons[collection.slug] = collection.icon;
  }
  for (const area of config.areas || []) {
    icons[area.slug] = area.icon;
  }

  return { ...config, icons } as const;
};

/**
 * The panel's own config defaults: navigation groups, language, header components.
 *
 * Read `index.ts` for what this is part of. This file is one half of it; `icons.ts` is the other.
 */
const withDefaults = <const T extends { panel?: Omit<PanelConfig, '$access'> }>(config: T) => {
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

/**
 * What every config needs before a panel can render it: the slug → icon map, and `panel` itself
 * with its navigation groups, language and header components filled in.
 *
 * Two steps and one order — the icon map covers the collections that exist when it runs, so it
 * goes first, and `config/configure.ts` places this whole thing before the two steps that derive
 * collections. They were two exports called from a one-line lambda in the config chain; the
 * chain names one step per folder now.
 */
export const configurePanel = <T extends Parameters<typeof withIcons>[0]>(config: T) =>
  withDefaults(withIcons(config) as Parameters<typeof withDefaults>[0]);
