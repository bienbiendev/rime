import type { FieldHook, FieldHookDuplicate } from '#lib/fields/types.js';
import type { RichTextField } from './index.js';

/** The browser never duplicates: the value as it is. */
export const duplicateRichText: FieldHookDuplicate<RichTextField> = (value) => value;

/**
 * The browser reads no document: the value as it is. `module.server.ts` fills the nodes naming
 * one.
 */
export const populateReferences: FieldHook<RichTextField> = async (value) => value;
