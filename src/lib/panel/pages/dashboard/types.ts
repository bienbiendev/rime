import type { ResolvedPathname } from '$app/types';
import type { AreaSlug, CollectionSlug, GenericDoc } from '$lib/core/prototype/types.js';

export type DashboardEntry =
  | {
      slug: CollectionSlug;
      title: string;
      titleSingular: string;
      link: ResolvedPathname;
      canCreate?: boolean;
      layout?: 'rows' | 'grid';
      prototype: 'collection';
      description: string | null;
      lastEdited?: GenericDoc[];
    }
  | {
      slug: AreaSlug;
      title: string;
      link: ResolvedPathname;
      prototype: 'area';
      description: string | null;
      lastEdited?: GenericDoc[];
    };
