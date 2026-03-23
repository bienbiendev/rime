import type { SimplerField } from '$lib/fields/types.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { FormContext } from '$lib/panel/context/form.svelte.js';
import type { EmailField } from '../index.js';

export interface EmailFieldProps {
	path?: string;
	config: SimplerField<EmailField>;
	type?: 'text' | 'password';
	form: DocumentFormContext | FormContext;
}
