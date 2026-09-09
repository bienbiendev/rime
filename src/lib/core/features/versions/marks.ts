/**
 * The marks this feature owns.
 *
 * Declared beside the feature rather than in core's `HOOK_MARKS`, and namespaced to it — which is
 * what lets a feature name a point in the pipeline without core knowing the feature exists, and
 * stops two owners reaching for the same word and silently sharing it. See
 * `core/pipeline/marks.ts`.
 */
export const VERSIONS_MARKS = {
  /** Which of the kinds of version write this update is. */
  OPERATION: 'versions:operation'
} as const;
