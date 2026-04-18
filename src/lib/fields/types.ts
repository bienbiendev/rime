import type { OperationContext } from '$lib/core/operations/hooks/index.server.js';
import type { DocumentFormContext } from '$lib/panel/index.js';
import type { Dic, WithRequired } from '$lib/util/types.js';
import type { IconProps } from '@lucide/svelte';
import type { RequestEvent } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { User } from '../core/collections/auth/types.js';
import type { FieldPanelTableConfig } from '../panel/types.js';
export type { BlocksField, BlocksFieldBlock } from './blocks/index.js';
export type { CheckboxField } from './checkbox/index.js';
export type { ComboBoxField } from './combobox/index.js';
export type { ComponentField } from './component/index.js';
export type { DateField } from './date/index.js';
export type { EmailField } from './email/index.js';
export type { GroupField } from './group/index.js';
export type { LinkField } from './link/index.js';
export type { NumberField } from './number/index.js';
export type { RadioField } from './radio/index.js';
export type { RelationField } from './relation/index.js';
export type { RichTextField } from './rich-text/index.js';
export type { SelectField } from './select/index.js';
export type { SeparatorField } from './separator/index.js';
export type { SlugField } from './slug/index.js';
export type { TabsField } from './tabs/index.js';
export type { TextField } from './text/index.js';
export type { TextAreaField } from './textarea/index.js';
export type { TimeField } from './time/index.js';
export type { ToggleField } from './toggle/index.js';

export type FieldValidationFunc<TConfig extends FormField, TData extends Dic = Dic> = (
  value: unknown,
  metas: {
    data: Partial<TData>;
    operation: 'create' | 'update' | undefined;
    id: string | undefined;
    user: User | undefined;
    locale: string | undefined;
    config: TConfig extends FormField ? TConfig : FormField;
  }
) => true | string;

type FieldAccessParams = { id?: string };
export type FieldAccess = (user: User | undefined, params?: FieldAccessParams) => boolean;
export type FieldWidth = '1/3' | '1/2' | '2/3';

// Base type for all fields
export type Field = {
  type: string;
  live?: boolean;
  condition?: (doc: any, siblings: any) => boolean;
  width?: FieldWidth;
  className?: string;
  component: Component<any>;
  cell: Component<any> | undefined;
  access: {
    create: FieldAccess;
    read: FieldAccess;
    update: FieldAccess;
  };
};

// Base type for fields that store data
export type FormField = Field & {
  name: string;
  hidden?: boolean;
  validate?: FieldValidationFunc<any>;
  required?: boolean;
  localized?: boolean;
  label?: string;
  hint?: string;
  table?: FieldPanelTableConfig;
  hooks?: FieldHooks;
  defaultValue?: DefaultValueFn<any> | unknown;
  isEmpty: (value: unknown) => boolean;
};

export type DefaultValueFn<T> = ({ event }: { event?: RequestEvent }) => T;

export type FieldHookContext<T extends FormField = FormField> = {
  event: RequestEvent;
  /** The document Id being processed */
  documentId?: string;
  /** The full operation context */
  operation: OperationContext;
  /** The field config */
  config: T;
};

export type FieldHookShared<T extends FormField = any> = (
  value: any,
  context: { config: T; data: Dic }
) => any;

export type FieldHookClient = (
  value: any,
  context: {
    siblings: Record<string, any>;
    useField: DocumentFormContext['useField'];
    useBlocks: DocumentFormContext['useBlocks'];
    useTree: DocumentFormContext['useTree'];
  }
) => any;

export type FieldHook<T extends FormField = any> = (
  value: any,
  context: FieldHookContext<T>
) => any;

type FieldHooks = {
  beforeRead?: FieldHook[];
  beforeSave?: FieldHook[];
  beforeValidate?: FieldHookShared[];
  onChange?: FieldHookClient[];
};

export type Option = {
  value: string;
  label?: string;
};

export type OptionWithIcon = {
  value: string;
  label?: string;
  icon?: Component<IconProps>;
};

export type RelationValue<T> =
  | T[]
  | { id?: string; relationTo: string; documentId: string }[]
  | string[]
  | string;

export type SimplerField<T extends FormField> = WithRequired<
  Partial<T>,
  'name' | 'isEmpty' | 'type'
>;
