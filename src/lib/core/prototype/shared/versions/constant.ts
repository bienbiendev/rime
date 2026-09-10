/**
 * What a version row's `status` column holds.
 *
 * Lived in `core/constants.ts`, which is core declaring a feature's vocabulary. It is shared
 * widely — six files in this feature, the panel's four version components — but shared is not the
 * same as central: every one of those readers is asking this feature a question.
 */
export const VERSIONS_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
} as const;

export type VersionsStatus = (typeof VERSIONS_STATUS)[keyof typeof VERSIONS_STATUS];
