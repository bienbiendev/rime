import { BlockquoteFeature } from './blockquote.js';
import { BoldFeature } from './bold.js';
import { BulletListFeature } from './bullet-list.js';
import { HeadingFeature } from './heading.js';
import { HorizontalRuleFeature } from './hr/hr.js';
import { LinkFeature } from './link/index.js';
import { OrderedListFeature } from './ordered-list.js';
import { ParagraphFeature } from './paragraph.js';

export const defaultFeatures = [
  ParagraphFeature,
  HeadingFeature(2, 3, 4),
  BoldFeature,
  LinkFeature(),
  HorizontalRuleFeature,
  BulletListFeature,
  OrderedListFeature,
  BlockquoteFeature
];
