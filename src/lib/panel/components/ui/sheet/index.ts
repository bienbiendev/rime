import { Dialog as SheetPrimitive } from 'bits-ui';

import Content from './sheet-content.svelte';
import Description from './sheet-description.svelte';
import Footer from './sheet-footer.svelte';
import Header from './sheet-header.svelte';
import Overlay from './sheet-overlay.svelte';
import Title from './sheet-title.svelte';
import Root from './sheet.svelte';

// const Root = SheetPrimitive.Root;
const Close = SheetPrimitive.Close;
const Trigger = SheetPrimitive.Trigger;
const Portal = SheetPrimitive.Portal;

export {
  Close,
  Content,
  Description,
  Footer,
  Header,
  Overlay,
  Portal,
  Root,
  //
  Root as Sheet,
  Close as SheetClose,
  Content as SheetContent,
  Description as SheetDescription,
  Footer as SheetFooter,
  Header as SheetHeader,
  Overlay as SheetOverlay,
  Portal as SheetPortal,
  Title as SheetTitle,
  Trigger as SheetTrigger,
  Title,
  Trigger
};

export const sheetTransitions = {
  top: {
    in: {
      y: '-100%',
      duration: 500,
      opacity: 1
    },
    out: {
      y: '-100%',
      duration: 300,
      opacity: 1
    }
  },
  bottom: {
    in: {
      y: '100%',
      duration: 500,
      opacity: 1
    },
    out: {
      y: '100%',
      duration: 300,
      opacity: 1
    }
  },
  left: {
    in: {
      x: '-100%',
      duration: 500,
      opacity: 1
    },
    out: {
      x: '-100%',
      duration: 300,
      opacity: 1
    }
  },
  right: {
    in: {
      x: '100%',
      duration: 500,
      opacity: 1
    },
    out: {
      x: '100%',
      duration: 300,
      opacity: 1
    }
  }
};

export type Side = 'top' | 'left' | 'bottom' | 'right';
