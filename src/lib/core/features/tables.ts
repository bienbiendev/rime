/**
 * How a feature describes storage it needs, in core's terms.
 *
 * A `versions` deviates a prototype's own table and a prototype's fields become its columns. Neither
 * covers a table that belongs to the **feature** — better-auth's four, an api-key store, an audit
 * log. Those were written out as drizzle source inside the schema generator, which is how the
 * database layer came to know that a collection called `staff` exists and is special.
 *
 * No drizzle here, and no SQL: a declaration says what the storage *is*, and the adapter decides
 * how to spell it. That is the same line `Adapter` draws, for the same reason — a second adapter
 * has to be able to satisfy this.
 */

/**
 * What a column holds.
 *
 * Six values, and deliberately only six: it is what the templates this replaces actually emit, and
 * a wider set is a schema DSL nobody asked for. `timestamp` and `timestampMs` are two entries
 * rather than one because they are two storage formats — epoch seconds and epoch milliseconds —
 * and better-auth's own tables use both.
 */
export type ColumnType =
  'text' | 'integer' | 'real' | 'boolean' | 'timestamp' | 'timestampMs' | 'json';

export type ColumnDeclaration = {
  /** The document-side name. The adapter derives the stored column name from it. */
  name: string;
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  unique?: boolean;
  /** Written into the schema as the column's `DEFAULT`, so only a literal. */
  defaultValue?: string | number | boolean;
  /**
   * A foreign key, named in slug space — never as a table.
   *
   * `column` defaults to `id` and `onDelete` to `cascade`, which is every case there is today.
   * A declaration may point at its own `table`: a directory's parent is a directory, which is the
   * one shape a prototype's own fields never produce.
   */
  references?: { table: string; column?: string; onDelete?: 'cascade' | 'set null' };
};

export type TableDeclaration = {
  /**
   * The table's slug, `$`-prefixed to mark it rime-derived — `$authUsers`.
   *
   * It is an identifier, not a table name: the adapter maps it to both the name the schema exports
   * it under and the name it has in the database.
   */
  slug: string;
  columns: ColumnDeclaration[];
};
