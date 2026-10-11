import { Dialog as SheetPrimitive } from 'bits-ui';

import Content from './sheet-content.svelte';
import Overlay from './sheet-overlay.svelte';
import Root from './sheet.svelte';

const Portal = SheetPrimitive.Portal;

export {
  Content,
  Root,
  //
  Overlay as SheetOverlay,
  Portal as SheetPortal
};

export type Side = 'top' | 'left' | 'bottom' | 'right';
