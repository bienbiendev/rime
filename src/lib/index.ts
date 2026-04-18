import handlers from '$lib/core/handlers/index.js';
export { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
export { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
export { definePlugin } from '$lib/core/plugins/index.js';

export { handlers };

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
