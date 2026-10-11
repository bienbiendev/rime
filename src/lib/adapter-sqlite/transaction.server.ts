import type { SqliteDatabase } from './types.server.js';

/** A built query: `.all()` runs it and answers its rows, at once or as a promise. */
type Statement = { all: () => unknown };

/**
 * Runs the statements `build` makes on the transaction, in order, all or none, and answers the
 * rows of each.
 *
 * bun:sqlite commits as soon as the callback returns, so there every statement runs inside the
 * callback with no `await`. libsql keeps the transaction open across awaits.
 *
 * ```ts
 * await inTransaction(db, (tx) => rows.map((row) => tx.update(paths).set(row.set).where(row.where)));
 * ```
 *
 * The statements are built on `tx`, not `db`: under libsql the transaction holds a connection of
 * its own, and a statement built on `db` would run outside it.
 */
export const inTransaction = async (
  db: SqliteDatabase,
  build: (tx: SqliteDatabase) => Statement[]
): Promise<unknown[][]> => {
  if (db._.resultKind === 'sync') {
    return db.transaction((tx) =>
      build(tx as SqliteDatabase).map((statement) => statement.all() as unknown[])
    );
  }
  return db.transaction(async (tx) => {
    const results: unknown[][] = [];
    for (const statement of build(tx as SqliteDatabase)) {
      results.push((await statement.all()) as unknown[]);
    }
    return results;
  });
};
