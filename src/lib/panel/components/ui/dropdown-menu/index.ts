import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import Item from './dropdown-menu-item.svelte';
import GroupHeading from './dropdown-menu-group-heading.svelte';
import Content from './dropdown-menu-content.svelte';
import RadioItem from './dropdown-menu-radio-item.svelte';
import Trigger from './dropdown-menu-trigger.svelte';
import Separator from './dropdown-menu-separator.svelte';
import CheckboxItem from './dropdown-menu-checkbox-item.svelte';

const Sub = DropdownMenuPrimitive.Sub;
const Root = DropdownMenuPrimitive.Root;
const Group = DropdownMenuPrimitive.Group;
const RadioGroup = DropdownMenuPrimitive.RadioGroup;
const Portal = DropdownMenuPrimitive.Portal;

export {
  Sub,
  Root,
  Item,
  GroupHeading,
  Group,
  Trigger,
  Content,
  Separator,
  RadioItem,
  RadioGroup,
  CheckboxItem,
  Portal,
  //
  Root as DropdownMenu,
  Sub as DropdownMenuSub,
  Item as DropdownMenuItem,
  GroupHeading as DropdownMenuGroupHeading,
  Group as DropdownMenuGroup,
  Content as DropdownMenuContent,
  Trigger as DropdownMenuTrigger,
  RadioItem as DropdownMenuRadioItem,
  Separator as DropdownMenuSeparator,
  RadioGroup as DropdownMenuRadioGroup,
  CheckboxItem as DropdownMenuCheckboxItem
};
