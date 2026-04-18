import type { WithRequired } from 'better-auth/svelte';
import type { Component, Snippet } from 'svelte';
import type { GenericDoc } from '../core/types/doc.js';
export type { Navigation } from './navigation.js';

export type Route = {
  title: string;
  icon?: any;
  url: string;
};

export type FieldPanelTableConfig = {
  cell?: Component<{ value: any }>;
  sort?: boolean;
  position: number;
};

export type CollectionProps = {
  data: {
    docs: GenericDoc[];
    status: number;
    canCreate: boolean;
  };
  children: Snippet;
};

export type Aria = WithRequired<Partial<Route>, 'title'>[];

export type FormErrors<T extends string = string> = Record<T, string>;
