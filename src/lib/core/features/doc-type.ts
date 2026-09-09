import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';

/**
 * What a feature adds to a prototype's **generated document type**.
 *
 * `dev/codegen/types` wrote these itself: `if (collection.versions) push('versionId: string')`,
 * and three reads of `collection.upload`. Two features named by config member in the one place
 * that decides what a consumer's `PagesDoc` looks like.
 *
 * Nothing here is drizzle or SQL — a `DocTypeContribution` is TypeScript source, which is what
 * this generator emits. `extends` names a type by the name it is exported under from the package's
 * `/types` entry, and codegen adds the import.
 */
export type DocTypeContribution = {
  /** Types the generated doc intersects with — upload's `UploadDoc`. */
  extends?: string[];
  /** Extra members, one per line, in `name: type` form. No trailing separator. */
  members?: string[];
  /**
   * Which of the config's own fields still generate a member.
   *
   * For a feature whose fields are described by something other than their builders: upload's
   * image sizes become one `sizes` object, so the per-size fields must not also appear.
   * Absent means every field, and several features' predicates are ANDed.
   */
  fields?: (field: FieldBuilder) => boolean;
};
