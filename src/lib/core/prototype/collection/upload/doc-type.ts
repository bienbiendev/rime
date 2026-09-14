import type { DocTypeContribution } from '$lib/core/dev/codegen/types/contributions.server.js';
import type { ImageSizesConfig } from '$lib/core/prototype/collection/upload/types.js';
import type { Dic } from '$lib/util/types.js';

/**
 * What an upload document's type carries, and which of its fields describe themselves.
 *
 * Three reads of `collection.upload` in `dev/codegen/types` — the `UploadDoc` intersection, the
 * `sizes` object, and the filter that keeps the per-size fields from appearing twice.
 */
export const uploadDocType = (config: { upload?: { imageSizes?: ImageSizesConfig[] } } | Dic) => {
  const sizes =
    (config.upload as { imageSizes?: ImageSizesConfig[] } | undefined)?.imageSizes ?? [];

  const contribution: DocTypeContribution = { extends: ['UploadDoc'] };
  if (!sizes.length) return contribution;

  return {
    ...contribution,
    members: [sizesMember(sizes)],
    /**
     * Each image size becomes a column named after it, and its type comes from the `sizes` object
     * above rather than from the field's own builder — so the field itself generates nothing.
     * Every other field, blocks and tabs included, generates its type as on any collection.
     */
    fields: (field) => !sizes.some((s) => s.name === field.name)
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
