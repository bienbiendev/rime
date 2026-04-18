import { Popover as PopoverPrimitive } from 'bits-ui';
import Content from './popover-content.svelte';
const Root = PopoverPrimitive.Root;
const Trigger = PopoverPrimitive.Trigger;
const Close = PopoverPrimitive.Close;
const Portal = PopoverPrimitive.Portal;

export {
  Root,
  Content,
  Portal,
  Trigger,
  Close,
  //
  Root as Popover,
  Content as PopoverContent,
  Portal as PopoverPortal,
  Trigger as PopoverTrigger,
  Close as PopoverClose
};
