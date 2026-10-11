import { Dialog as DialogPrimitive } from 'bits-ui';

import Title from './dialog-title.svelte';
import Footer from './dialog-footer.svelte';
import Header from './dialog-header.svelte';
import Overlay from './dialog-overlay.svelte';
import Content from './dialog-content.svelte';

const Root = DialogPrimitive.Root;
const Trigger = DialogPrimitive.Trigger;
const Portal = DialogPrimitive.Portal;

export { Root, Title, Portal, Footer, Header, Trigger, Overlay, Content };
