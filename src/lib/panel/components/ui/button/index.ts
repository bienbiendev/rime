import type { WithElementRef } from 'bits-ui';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import Root from './button.svelte';

type PrimitiveAnchorAttributes = WithElementRef<HTMLAnchorAttributes>;
type PrimitiveButtonAttributes = WithElementRef<HTMLButtonAttributes>;

export type ButtonVariant =
  'success' | 'default' | 'ghost' | 'link' | 'text' | 'secondary' | 'outline';
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm';

type Props = PrimitiveButtonAttributes &
  PrimitiveAnchorAttributes & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: any;
    disabled?: boolean;
  };

export {
  //
  Root as Button,
  Root,
  type Props as ButtonProps,
  type Props
};
