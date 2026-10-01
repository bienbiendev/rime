import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { RichTextFieldBuilder } from '../index.js';

export type RichTextFieldProps = {
  class?: string;
  path: string;
  config: RichTextFieldBuilder;
  form: DocumentFormContext;
};
