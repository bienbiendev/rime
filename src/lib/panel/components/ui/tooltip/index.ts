import { Tooltip as TooltipPrimitive } from 'bits-ui';
import Content from './tooltip-content.svelte';

const Root: typeof TooltipPrimitive.Root = TooltipPrimitive.Root;
const Portal = TooltipPrimitive.Portal;
const Trigger: typeof TooltipPrimitive.Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export { Root, Portal, Trigger, Content, Provider };
