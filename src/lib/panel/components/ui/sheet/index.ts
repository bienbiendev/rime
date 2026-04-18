import { Dialog as SheetPrimitive } from 'bits-ui';

import Overlay from './sheet-overlay.svelte';
import Content from './sheet-content.svelte';
import Header from './sheet-header.svelte';
import Footer from './sheet-footer.svelte';
import Title from './sheet-title.svelte';
import Description from './sheet-description.svelte';
import Root from './sheet.svelte';

// const Root = SheetPrimitive.Root;
const Close = SheetPrimitive.Close;
const Trigger = SheetPrimitive.Trigger;
const Portal = SheetPrimitive.Portal;

export {
  Root,
  Close,
  Trigger,
  Portal,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
  //
  Root as Sheet,
  Close as SheetClose,
  Trigger as SheetTrigger,
  Portal as SheetPortal,
  Overlay as SheetOverlay,
  Content as SheetContent,
  Header as SheetHeader,
  Footer as SheetFooter,
  Title as SheetTitle,
  Description as SheetDescription
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
