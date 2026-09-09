import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Dic } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';

/**
 * The slug → icon map the panel navigates by, gathered from every prototype config.
 *
 * A feature-derived collection (upload's `<slug>Directories`, versions' aliases) has no entry:
 * `panel` is listed before `upload` and `versions`, so they do not exist yet when this runs. That
 * is the behaviour the chain had before the panel became a feature, and the feature list is where
 * it is now declared — see index.ts.
 */
export const augmentIcons = <
  const T extends { collections?: BuiltCollection[]; areas?: BuiltArea[] }
>(
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
