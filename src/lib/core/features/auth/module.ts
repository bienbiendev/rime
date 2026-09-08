export { augmentAuth } from './augment.js';
export { augmentStaff } from './staff/augment.js';

/** Client-side stub */
export const blankAuthDocument = () => {
  throw Error('blankAuthDocument not supported client side');
};
