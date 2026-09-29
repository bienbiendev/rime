// rimecms: what a config and the panel import. A site page imports rimecms/public.
import i18n, { t__ } from '$lib/core/i18n/index.js';

export type { Dictionaries, I18n, PanelLanguage, Translate } from '$lib/core/i18n/index.js';
export { definePlugin } from '$lib/core/plugins/index.js';
export { i18n, t__ };

declare module 'rimecms' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface RegisterCollection {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface RegisterArea {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface RegisterSchema {}

  // Main Register interface that combines all registrations
  export interface Register {
    PrototypeSlug: keyof RegisterCollection | keyof RegisterArea;
    CollectionSlug: keyof RegisterCollection;
    AreaSlug: keyof RegisterArea;
    Schema: RegisterSchema['schema'];
    Tables: RegisterSchema['tables'];
    Relations: RegisterSchema['relations'];
  }
}

// Utility type for accessing register types
export type GetRegisterType<K extends keyof Register> = Register[K];
