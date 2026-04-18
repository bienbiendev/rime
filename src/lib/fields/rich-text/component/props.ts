import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { RichTextField } from '../index.js';

export type RichTextFieldProps = {
  class?: string;
  path: string;
  standAlone?: boolean;
  config: RichTextField;
  form: DocumentFormContext;
};
