export const mimeTypesMap: Record<string, string[]> = {
	// Images
	'image/jpeg': ['jpg', 'jpeg'],
	'image/png': ['png'],
	'image/gif': ['gif'],
	'image/webp': ['webp'],
	'image/svg+xml': ['svg'],
	'image/bmp': ['bmp'],
	'image/tiff': ['tif', 'tiff'],

	// Documents
	'application/pdf': ['pdf'],
	'application/msword': ['doc'],
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
	'application/vnd.ms-excel': ['xls'],
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
	'application/vnd.ms-powerpoint': ['ppt'],
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
	'text/plain': ['txt'],
	'text/csv': ['csv'],
	'text/html': ['html', 'htm'],

	// Audio
	'audio/mpeg': ['mp3'],
	'audio/wav': ['wav'],
	'audio/ogg': ['ogg'],
	'audio/midi': ['mid', 'midi'],
	'audio/aac': ['aac'],

	// Video
	'video/mp4': ['mp4'],
	'video/mpeg': ['mpeg', 'mpg'],
	'video/quicktime': ['mov'],
	'video/webm': ['webm'],
	'video/x-msvideo': ['avi'],
	'video/x-ms-wmv': ['wmv'],

	// Archives
	'application/zip': ['zip'],
	'application/x-rar-compressed': ['rar'],
	'application/x-7z-compressed': ['7z'],
	'application/gzip': ['gz'],

	// Code
	'application/json': ['json'],
	'application/xml': ['xml'],
	'text/javascript': ['js'],
	'text/css': ['css'],
	'application/x-httpd-php': ['php'],
	'application/x-python-code': ['py'],

	// Fonts
	'font/ttf': ['ttf'],
	'font/otf': ['otf'],
	'font/woff': ['woff'],
	'font/woff2': ['woff2']

	// Others
	// 'application/octet-stream': ['bin']
} as const;

export function getExtensionFromMimeType(mimeType: string): string | null {
	const extensions = mimeTypesMap[mimeType];
	return extensions ? extensions[0] : null;
}

export function getMimeTypeFromExtension(extension: string): string | null {
	// Remove the dot if present and convert to lowercase
	const ext = extension.replace(/^\./, '').toLowerCase();

	// Find the MIME type that includes this extension
	for (const [mimeType, extensions] of Object.entries(mimeTypesMap)) {
		if (extensions.includes(ext)) {
			return mimeType;
		}
	}
	return null;
}
