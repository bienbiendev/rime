import type { JsonFile } from '$lib/core/collections/upload/upload.js';
import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import { fileSizeToString } from '$lib/util/file.js';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { getExtensionFromMimeType, getMimeTypeFromExtension } from './mime.js';

export const jsonFileToFile = (jsonFile: JsonFile) => {
	// Convert base64 to Blob
	const base64String = jsonFile.base64;
	// Extract the actual base64 content after the data URI prefix
	const base64Content = base64String.split(',')[1];

	if (!base64Content) {
		throw new RimeError(RimeError.UPLOAD, 'Invalid base64 data format');
	}

	try {
		const byteCharacters = atob(base64Content);
		const byteNumbers = new Array(byteCharacters.length);

		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);

		// Guess file type if not provided
		let mimeType = jsonFile.mimeType;
		if (!mimeType) {
			const base64Header = base64String.split(';')[0].split(':')[1];
			if (base64Header) {
				mimeType = base64Header;
			} else {
				mimeType = 'application/octet-stream';
			}
		}

		const extension = getExtensionFromMimeType(mimeType);
		if (!extension) {
			throw new RimeError(RimeError.UPLOAD, 'File type not supported');
		}

		const blob = new Blob([byteArray], { type: mimeType });

		const filename = jsonFile.filename || `file-${Date.now()}.${extension}`;
		const lastModified = jsonFile.lastModified || Date.now();
		const filesize = fileSizeToString(jsonFile.filesize || blob.size);

		return {
			filename,
			mimeType,
			filesize,
			file: new File([blob], filename, {
				type: mimeType,
				lastModified: lastModified
			})
		};
	} catch (err: any) {
		logger.error('Error converting base64 to File:', err.message);
		throw new RimeError(RimeError.UPLOAD, 'Invalid base64 content');
	}
};

export async function filePathToBase64(filePath: string): Promise<string> {
	try {
		const data = await readFile(filePath);
		const ext = filePath.split('.').pop()?.toLowerCase() || '';
		const mimeType = getMimeTypeFromExtension(ext);
		if (!mimeType) {
			throw new Error(`Unsupported file extension: ${ext}`);
		}
		const base64 = data.toString('base64');
		return `data:${mimeType};base64,${base64}`;
	} catch (error: any) {
		logger.error('Error converting file path to base64:', error.message);
		throw error;
	}
}

/**
 * Convert a filepath to a File like object
 * @param filePath - Absolute path to the file
 * @returns A File-like object with necessary properties and methods
 * @example
 * const file = await filePathToFile('/path/to/image.jpg');
 */
export async function filePathToFile(filePath: string): Promise<File> {
	try {
		// Check if file exists
		if (!fs.existsSync(filePath)) {
			throw new RimeError(RimeError.UPLOAD, `File not found: ${filePath}`);
		}

		// Read file stats and content
		const fileStats = fs.statSync(filePath);
		const buffer = fs.readFileSync(filePath);

		// Get filename and extension
		const filename = path.basename(filePath);
		const ext = path.extname(filePath).slice(1).toLowerCase();
		const mimeType = getMimeTypeFromExtension(ext) || 'application/octet-stream';

		// Create a Blob with the file content
		const blob = new Blob([buffer], { type: mimeType });

		// Create and return a File object
		return new File([blob], filename, {
			type: mimeType,
			lastModified: fileStats.mtimeMs
		});
	} catch (error: any) {
		logger.error('Error creating File from path:', error.message);
		throw new RimeError(RimeError.UPLOAD, `Failed to create File from path: ${error.message}`);
	}
}
