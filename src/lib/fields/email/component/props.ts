import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { FormContext } from '$lib/panel/context/form.svelte.js';
import type { EmailFieldBuilder } from '../index.js';

export interface EmailFieldProps {
  path?: string;
  config: EmailFieldBuilder;
  type?: 'text' | 'password';
  form: DocumentFormContext | FormContext;
}
