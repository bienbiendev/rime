import type { FieldHook, LinkField } from '../types.js';
import type { Link } from './types.js';

export const populateRessourceURL: FieldHook<LinkField> = async (link: Link) => link;
