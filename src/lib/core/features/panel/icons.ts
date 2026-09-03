import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { Dic } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';

/**
 * The slug → icon map the panel navigates by, gathered from every prototype config.
 *
 * Runs before the features' `configure` steps, which is why a feature-derived collection
 * (upload's `<slug>Directories`) has no entry: it does not exist yet. That is today's behaviour,
 * kept deliberately — see augment.ts for why these three are chain steps rather than a feature's
 * `configure`.
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
