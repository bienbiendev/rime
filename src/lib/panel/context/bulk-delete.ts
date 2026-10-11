/**
 * What the panel says once a bulk delete answers: the documents the answer lists went, and a row
 * the caller may not delete stayed.
 *
 * ```ts
 * deletedToast(3, 2); // { kind: 'warning', message: 'Deleted 2 of 3 docs: 1 could not be deleted' }
 * ```
 */
export const deletedToast = (asked: number, deleted: number) =>
  deleted < asked
    ? {
        kind: 'warning' as const,
        message: `Deleted ${deleted} of ${asked} docs: ${asked - deleted} could not be deleted`
      }
    : { kind: 'success' as const, message: `Successfully deleted ${deleted} docs` };
