import type { WithElementRef } from 'bits-ui';
import Root from './button.svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { HTMLAnchorAttributes } from 'svelte/elements';

type PrimitiveAnchorAttributes = WithElementRef<HTMLAnchorAttributes>;
type PrimitiveButtonAttributes = WithElementRef<HTMLButtonAttributes>;

export type ButtonVariant =
  | 'success'
  | 'default'
  | 'ghost'
  | 'link'
  | 'text'
  | 'secondary'
  | 'outline';
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm';

type Props = PrimitiveButtonAttributes &
  PrimitiveAnchorAttributes & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: any;
    disabled?: boolean;
  };

export {
  Root,
  type Props,
  //
  Root as Button,
  type Props as ButtonProps
};
