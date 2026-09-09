/** A config has a public URL by declaring `$url`. */
export const hasUrl = (config: { $url?: unknown }): boolean => !!config.$url;
