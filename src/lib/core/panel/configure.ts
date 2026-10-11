import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import type { Component } from 'svelte';
import type { Dic } from '#lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { PanelConfig } from '#lib/core/panel/types.js';
import Book from '@lucide/svelte/icons/book';
import BookCopy from '@lucide/svelte/icons/book-copy';
import BookType from '@lucide/svelte/icons/book-type';
import SlidersVertical from '@lucide/svelte/icons/sliders-vertical';

/**
 * The slug → icon map the panel navigates by, gathered from every prototype config.
 *
 * A feature-derived collection (upload's `<slug>Directories`, the `$<slug>__versions` collections)
 * has no entry: `config/configure.ts` runs `configurePanel` before `configureUploadDirectories` and
 * `configureVersions`, so they do not exist yet.
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
 */
const withDefaults = <const T extends { panel?: Omit<PanelConfig, '$access'> }>(config: T) => {
  const panelNavigationGroups = [
    ...(config.panel?.navigation?.groups || []),
    { label: 'content', icon: BookType },
    { label: 'system', icon: SlidersVertical },
    { label: 'collections', icon: BookCopy },
    { label: 'areas', icon: Book }
  ] as const;

  const panel = {
    ...config.panel,
    routes: config.panel?.routes ?? {},
    language: config.panel?.language || 'en',
    navigation: { groups: panelNavigationGroups },
    components: {
      ...config.panel?.components,
      header: config.panel?.components?.header || []
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
 * collections.
 */
export const configurePanel = <T extends Parameters<typeof withIcons>[0]>(config: T) =>
  withDefaults(withIcons(config) as Parameters<typeof withDefaults>[0]);
