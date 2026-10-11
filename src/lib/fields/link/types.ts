import type { GetRegisterType } from '#lib/index.js';

export type LinkType = 'url' | 'email' | 'tel' | 'anchor' | GetRegisterType<'PrototypeSlug'>;
export type Link = {
  type: LinkType;
  value: string | null;
  target: '_self' | '_blank';
  /** A document link's: its target document's id, filled on read. */
  id?: string;
  /** A document link's: its target's address, filled on read. */
  url?: string;
  /** A document link's: its target's title, filled on read. */
  title?: string;
};
