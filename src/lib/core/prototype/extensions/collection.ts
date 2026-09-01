import { definePrototype } from '../define.js';

/**
 * A collection is the plain case: many documents, all four operations, nothing to do at boot.
 *
 * It exists as a definition rather than as "the absence of area" so that code iterating the
 * registry sees both kinds, and so `singleton: false` is stated rather than implied.
 */
export const collection = definePrototype();
