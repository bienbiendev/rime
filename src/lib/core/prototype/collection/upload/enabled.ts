/** A collection stores files by declaring `upload`. */
export const isUpload = (config: { upload?: unknown }): boolean => !!config.upload;
