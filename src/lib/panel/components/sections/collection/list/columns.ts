type Tracks = {
  /** How many `table()` columns the config adds after the title. */
  columns?: number;
  /** A status column, for a collection with drafts. */
  status?: boolean;
  /** Who last edited. */
  author?: boolean;
};

/**
 * The tracks of a list row and of its header: the checkbox, the title, the config's columns,
 * the status, the author, then when.
 *
 * ```ts
 * listColumns({ columns: 1, status: true, author: true })
 * // 'var(--rz-size-4) minmax(0, 2fr) minmax(0, 1fr) var(--rz-size-28) var(--rz-size-32) var(--rz-size-24)'
 * listColumns({})
 * // 'var(--rz-size-4) minmax(0, 2fr) var(--rz-size-24)'
 * ```
 */
export function listColumns({ columns = 0, status = false, author = false }: Tracks) {
  return [
    'var(--rz-size-4)',
    'minmax(0, 2fr)',
    ...Array<string>(columns).fill('minmax(0, 1fr)'),
    status && 'var(--rz-size-28)',
    author && 'var(--rz-size-32)',
    'var(--rz-size-24)'
  ]
    .filter(Boolean)
    .join(' ');
}
