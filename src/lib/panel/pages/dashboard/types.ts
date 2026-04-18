import type { AreaSlug, CollectionSlug, GenericDoc } from '$lib/core/types/doc.js';

export type DashboardEntry =
  | {
      slug: CollectionSlug;
      title: string;

      titleSingular: string;
      link: string;
      canCreate?: boolean;
      prototype: 'collection';
      description: string | null;
      lastEdited?: GenericDoc[];
    }
  | {
      slug: AreaSlug;
      title: string;
      link: string;
      prototype: 'area';
      description: string | null;
      lastEdited?: GenericDoc[];
    };
