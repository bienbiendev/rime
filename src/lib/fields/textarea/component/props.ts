import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { FormContext } from '$lib/panel/context/form.svelte.js';
import type { TextAreaFieldBuilder } from '../index.js';

export type TextAreaFieldProps = {
  path?: string;
  config: TextAreaFieldBuilder;
  type?: 'text' | 'password';
  form: DocumentFormContext | FormContext;
};
