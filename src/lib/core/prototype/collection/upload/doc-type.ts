import type { ImageSizesConfig } from '$lib/core/config/types.js';
import { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { DocTypeContribution } from '$lib/core/features/doc-type.js';

/**
 * What an upload document's type carries, and which of its fields describe themselves.
 *
 * Three reads of `collection.upload` in `dev/codegen/types` — the `UploadDoc` intersection, the
 * `sizes` object, and the filter that keeps the per-size fields from appearing twice.
 */
export const uploadDocType = (config: { upload?: { imageSizes?: ImageSizesConfig[] } }) => {
  const sizes = config.upload?.imageSizes ?? [];

  const contribution: DocTypeContribution = { extends: ['UploadDoc'] };
  if (!sizes.length) return contribution;

  return {
    ...contribution,
    members: [sizesMember(sizes)],
    /**
     * Each image size becomes a column named after it, and its type comes from the `sizes` object
     * above rather than from the field's own builder — so the field itself generates nothing.
     *
     * The `instanceof FormFieldBuilder` half is carried over verbatim and is almost certainly
     * wrong: it drops blocks, tabs, groups, tree and relation fields from the generated type of
     * any upload collection that declares image sizes. It has been that way since the filter was
     * written and no fixture has one, so changing it here would be an untested fix inside an
     * untested move. See docs/known-defects.md.
     */
    fields: (field) =>
      field instanceof FormFieldBuilder && !sizes.some((s) => s.name === field.name)
  } satisfies DocTypeContribution;
};

/** One member holding every generated size, matching what `generateImageSizesType` emitted. */
const sizesMember = (sizes: ImageSizesConfig[]) =>
  `sizes:{${sizes
    .map((size) =>
      size.out && size.out.length > 1
        ? size.out.map((format) => `${size.name}_${format}: string`).join(', ')
        : `${size.name}: string`
    )
    .join(', ')}}`;
