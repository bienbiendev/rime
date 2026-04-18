import type { SimplerField } from '$lib/fields/types.js';
import type { DocumentFormContext } from '$lib/panel/context/documentForm.svelte.js';
import type { FormContext } from '$lib/panel/context/form.svelte.js';
import type { IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { TextField } from '../index.js';

export type TextFieldProps = {
  path?: string;
  config: SimplerField<TextField>;
  type?: 'text' | 'password';
  icon?: Component<IconProps>;
  form: DocumentFormContext | FormContext;
};
