/** What a version row's `status` column holds. */
export const VERSIONS_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
} as const;

export type VersionsStatus = (typeof VERSIONS_STATUS)[keyof typeof VERSIONS_STATUS];

/** How long the panel waits after the last change before auto-saving. */
export const AUTO_SAVE_DELAY_MS = 1500;
