import type { FieldHook, LinkField } from '../types.js';
import type { Link } from './types.js';

// The client half returns the link as is. `module.server.ts` reads its target's id, url and title.
export const populateRessourceURL: FieldHook<LinkField> = async (link: Link) => link;
