import { toPascalCase } from '$lib/util/string.js';
import { templateRelationMany, templateRelationOne } from '../templates.server.js';
const p = toPascalCase;

/**
 * Generates Drizzle ORM relationship definitions from a relations dictionary
 * Creates both one-to-many and many-to-one relationship definitions by:
 * - Converting each entry into 'hasOne' relations (parent -> child)
 * - Creating 'hasMany' relations for reverse relationships (child -> parent)
 *
 * @example
 * const relationsDic = { pages: ['users', 'medias'] }
 *
 * output:
 * {
 *   relationsDefinitions: `
 *     export const rel_usersHasOnePages = relations(users, ({ one }) => ({
 *       pages: one(pages, {
 *         fields: [users.ownerId],
 *         references: [pages.id],
 *       })
 *     }))
 *
 *     export const rel_pagesHasMany = relations(pages, ({ many }) => ({
 *       users: many(users),
 *     }))`,
 *   relationsNames: ['rel_usersHasOnePages', 'rel_pagesHasMany']
 * }
 */
export function generateRelationshipDefinitions({ relationsDic }: Args): Return {
  if (Object.keys(relationsDic).length === 0)
    return { relationsDefinitions: '', relationsNames: [] };

  const relationsNames: string[] = [];

  let toOnes: string[] = [];
  const toManies: string[] = [];

  for (const [table, many] of Object.entries(relationsDic)) {
    toOnes = [
      ...toOnes,
      ...many.map((t) => {
        const name = `rel_${t}HasOne${p(table)}`;
        relationsNames.push(name);
        return templateRelationOne({ name, table: t, parent: table });
      })
    ];
    const name = `rel_${table}HasMany`;
    relationsNames.push(name);
    toManies.push(templateRelationMany({ name, table, many }));
  }

  return {
    relationsDefinitions: [...toOnes, ...toManies].join('\n\n'),
    relationsNames
  };
}

type Return = {
  /**
   * @example
   * export const rel_usersHasOnePages = relations(users, ({ one }) => ({
   *   pages : one(pages, {
   *     fields: [users.ownerId],
   *     references: [pages.id],
   *   }),
   * }))
   *
   * export const rel_pagesHasMany = relations(pages, ({ many }) => ({
   *   users: many(users),
   * }))
   */
  relationsDefinitions: string;
  /**
   * @example
   * [ 'rel_mediasHasOnePages', 'rel_usersHasOnePages', 'rel_pagesHasMany' ]
   */
  relationsNames: string[];
};

type Args = {
  // table: string;
  relationsDic: Record<string, string[]>;
};

export type RelationFieldsMap = Record<string, { to: string; localized?: boolean }>;
