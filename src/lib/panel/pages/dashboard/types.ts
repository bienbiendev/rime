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
      /** How many documents it holds, `null` when the count failed. */
      count?: number | null;
      /** How many of them are drafts. */
      drafts?: number;
    }
  | {
      slug: AreaSlug;
      title: string;
      link: ResolvedPathname;
      prototype: 'area';
      description: string | null;
      lastEdited?: GenericDoc[];
      /** When it was last saved. */
      updatedAt?: Date | string | null;
    };
