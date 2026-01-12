import type { UploadConfig } from '$lib/core/config/types.js';
import { text } from '$lib/fields/text/index.js';
import { toCamelCase } from '$lib/util/string.js';
import type { Collection, ImageSizesConfig } from '../../../types.js';
import { validatePath } from '../upload/util/path.js';

export type WithNormalizedUpload<T> = Omit<T, 'upload'> & { upload?: UploadConfig };

const withNormalizedUpload = <T extends { upload?: boolean | UploadConfig }>(
	config: T
): WithNormalizedUpload<T> => {
	// Create a new object without the auth property
	const { upload, ...rest } = config;
	// Determine the normalized upload value
	let normalizedUpload: undefined | UploadConfig;

	if (typeof upload === 'boolean') {
		normalizedUpload = upload === true ? {} : undefined;
	} else {
		normalizedUpload = upload;
	}

	// Return the new object with the normalized upload
	return {
		...rest,
		upload: normalizedUpload
	};
};

/**
 * Normalize config.upload and imagesSizes
 * add corresponding fields with validation if config.upload.accept is defined
 */
export const augmentUpload = <T extends Collection<any>>(config: T): WithNormalizedUpload<T> => {
	const normalizedUploadConfig = withNormalizedUpload(config);
	if (!normalizedUploadConfig.upload) return normalizedUploadConfig;

	const { upload } = normalizedUploadConfig;
	let fields = [...(config.fields || [])];

	if (upload) {
		// Add panel thumbnail size if not already present
		const isPanelThumbnailInSizes =
			upload.imageSizes &&
			upload.imageSizes.some((size: ImageSizesConfig) => size.name === 'thumbnail');
		if (!isPanelThumbnailInSizes) {
			const thumbnailSize = { name: 'thumbnail', width: 400, compression: 60 };
			upload.imageSizes = [thumbnailSize, ...(upload.imageSizes || [])];
		}

		// Add image size fields
		if ('imageSizes' in upload && upload.imageSizes?.length) {
			const sizesFields = upload.imageSizes.map((size: ImageSizesConfig) =>
				text(toCamelCase(size.name)).hidden()
			);
			fields = [...fields, ...sizesFields];
		}

		// Add mimeType field
		const mimeType = text('mimeType').table({ sort: true, position: 99 }).hidden();

		// Add validation if accept is defined
		if ('accept' in upload && Array.isArray(upload.accept)) {
			const allowedMimeTypes = upload.accept;
			mimeType.raw.validate = (value) => {
				return (
					(typeof value === 'string' && allowedMimeTypes.includes(value)) ||
					`File should be the type of ${allowedMimeTypes.toString()}`
				);
			};
		}

		const _pathField = text('_path')._root().hidden().validate(validatePath);

		// Add hidden fields
		fields.push(mimeType, text('filename').hidden(), text('filesize').hidden(), _pathField);
	}

	return { ...config, upload: upload || false, fields };
};
