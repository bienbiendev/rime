import { getI18nContext, setI18nContext } from '$lib/core/i18n/context.js';
import i18n, { createI18n, t__ } from '$lib/core/i18n/index.js';
import { cache } from '$lib/core/plugins/cache/index.js';
import { openSse } from '$lib/core/plugins/sse/index.js';
import LiveConsumer from '$lib/panel/components/sections/live/Consumer.svelte';
import LiveEdit from '$lib/panel/components/sections/live/LiveEdit.svelte';
import LiveProvider from '$lib/panel/components/sections/live/Provider.svelte';

export type { Dictionaries, I18n, PanelLanguage, Translate } from '$lib/core/i18n/index.js';
export { definePlugin } from '$lib/core/plugins/index.js';
export type { SSEEvent, SSEHandler } from '$lib/core/plugins/sse/index.js';
export {
  cache,
  createI18n,
  getI18nContext,
  i18n,
  LiveConsumer,
  LiveEdit,
  LiveProvider,
  openSse,
  setI18nContext,
  t__
};

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
