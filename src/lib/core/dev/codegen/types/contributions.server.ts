import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { isVersioned } from '$lib/core/prototype/shared/versions/enabled.js';
import { versionsDocType } from '$lib/core/prototype/shared/versions/doc-type.js';
import { isUpload } from '$lib/core/prototype/collection/upload/enabled.js';
import { uploadDocType } from '$lib/core/prototype/collection/upload/doc-type.js';

/**
 * What each config's generated doc type gains beyond its own fields.
 *
 * Two contributors and they are the whole list: `versions` adds `versionId`, `upload` extends
 * `UploadDoc`, adds its `sizes` member and filters out the fields its image sizes collide with.
 * The `fields` predicates are **ANDed** — each says which fields it still wants generated, and
 * a field has to survive both.
 *
 * Was `docTypeWithFeatures`, folding a `FeatureDefinition.docType` seam over every feature to
 * reach those two.
 */
export const contributionsFor = (
  config: BuiltArea | BuiltCollection
): Required<DocTypeContribution> =>
  // Upload before versions: the prototype's feature list has upload first, and the members land
  // in that order in the generated type.
  [isUpload(config) ? uploadDocType(config) : null, isVersioned(config) ? versionsDocType() : null]
    .filter((c): c is DocTypeContribution => c !== null)
    .reduce<Required<DocTypeContribution>>(
      (current, contribution) => ({
        extends: [...current.extends, ...(contribution.extends ?? [])],
        members: [...current.members, ...(contribution.members ?? [])],
        fields: contribution.fields
          ? (field) => current.fields(field) && contribution.fields!(field)
          : current.fields
      }),
      { extends: [], members: [], fields: () => true }
    );

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
