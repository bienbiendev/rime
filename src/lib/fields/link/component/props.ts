import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { LinkField } from '../index.js';

export type LinkFieldProps = {
  path: string;
  config: LinkField;
  form: DocumentFormContext;
};
