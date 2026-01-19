import { jsonFileToFile } from '$lib/core/collections/upload/util/converter.js';
import { RimeError } from '$lib/core/errors/index.js';
import { Hooks } from '$lib/core/operations/hooks/index.server.js';
import { isFile } from '$lib/util/file.js';

/**
 * Hook executed before save/update operations to convert base64 encoded files to File objects.
 *
 * @description
 * This hook performs the following operations:
 * 1. Checks if the incoming document contains a base64 encoded file
 * 2. Converts it to a proper File object for disk storage
 * 3. Preserves or generates metadata (filename, size, type)
 *
 * @param args Hook arguments containing the document to process
 * @returns Updated args object with converted file data
 */
export const castBase64ToFile = Hooks.beforeUpsert<'upload'>(async (args) => {
	let data = args.data;
	if (data?.file && !isFile(data.file)) {
		try {
			const { file, filename, filesize, mimeType } = jsonFileToFile(data.file);
			data = {
				...data,
				file,
				filename: data.filename || filename,
				filesize: data.filesize || filesize,
				mimeType: data.mimeType || mimeType
			};
		} catch (err: any) {
			args.event.locals.rime.logger.error(
				'Failed to convert base64 string to File object',
				err.message
			);
			throw new RimeError(RimeError.UPLOAD, 'Unable to process file');
		}
	}
	return { ...args, data };
});
