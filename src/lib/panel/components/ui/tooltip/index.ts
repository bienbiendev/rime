import { Tooltip as TooltipPrimitive } from 'bits-ui';
import Content from './tooltip-content.svelte';

const Root = TooltipPrimitive.Root;
const Portal = TooltipPrimitive.Portal;
const Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export {
  Root,
  Portal,
  Trigger,
  Content,
  Provider,
  //
  Root as Tooltip,
  Portal as TooltipPortal,
  Content as TooltipContent,
  Trigger as TooltipTrigger,
  Provider as TooltipProvider
};
