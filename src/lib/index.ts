import i18n, { t__ } from '$lib/core/i18n/index.js';
import { cache } from '$lib/core/plugins/cache/index.js';
import LiveConsumer from '$lib/panel/components/sections/live/Consumer.svelte';
import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';
import LiveProvider from '$lib/panel/components/sections/live/Provider.svelte';

export { definePlugin } from '$lib/core/plugins/index.js';
export { cache, i18n, LiveConsumer, LiveEdit, LiveProvider, t__ };
export type { Dictionaries, PanelLanguage } from '$lib/core/i18n/index.js';

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
  }
}

// Utility type for accessing register types
export type GetRegisterType<K extends keyof Register> = Register[K];
