import type { Component } from 'svelte';
import type { IconProps } from '@lucide/svelte';
import type { User } from '$lib/core/auth/types.js';
import type { PanelLanguage } from '$lib/core/i18n/index.js';
import type { DashboardEntry } from '$lib/panel/pages/dashboard/types.js';
import type { BuiltCollectionClient } from '$lib/core/config/types.js';

/** The groups the panel's sidebar shows, and the icon each carries. */
export type NavigationConfig = {
  groups: Array<{ label: string; icon: Component<IconProps> }>;
};

/** What an author writes under `panel`. */
export type PanelConfig = {
  /** who can accesss the panel */
  $access?: (user: User | undefined) => boolean;
  /** Custom panel routes that render a given component */
  routes?: Record<string, CustomPanelRoute>;
  /** The panel language, "en" or "fr" supports only */
  language?: PanelLanguage;
  /** Sidebar navigation groups labels and icons */
  navigation?: NavigationConfig;
  /** Specific components */
  components?: {
    /** Dashboard header */
    header?: Component[];
    /** Collection header */
    collectionHeader?: Component<{ config: BuiltCollectionClient }>[];
    /** Full dashboard component */
    dashboard?: Component<{ entries: DashboardEntry[]; user?: User }>;
  };
  /** a relative path from the "static" directory or an external url
   * @example
   * // for static/assets/custom.css
   * css : '/assets/custom.css'
   */
  css?: string;
};

export type CollectionPanelConfig =
  | false
  | {
      /** Description for the collection/area, basically displayed on the dashboard */
      description?: string;
      /** Sidebar navigation group */
      group?: string;
      /** Dashboard settings */
      dashboard?:
        | {
            layout?: 'rows' | 'grid';
            maxEntries?: number;
          }
        | false;
    };

export type CustomPanelRoute = {
  group?: string;
  label: string;
  icon?: Component<IconProps>;
  component: Component;
};
