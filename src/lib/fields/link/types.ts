import type { GetRegisterType } from '$lib/index.js';

export type LinkType = 'url' | 'email' | 'tel' | 'anchor' | GetRegisterType<'PrototypeSlug'>;
export type Link = {
  type: LinkType;
  value: string | null;
  target: '_self' | '_blank';
  url?: string;
};
