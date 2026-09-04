import { definePlugin, type Plugin } from '../index.js';
import { handleCORS } from './handler.server.js';

/**
 * Which origins may call the API, and the handler that enforces it.
 *
 * A plugin rather than a feature: `handler` is a member of `Plugin`, not of `FeatureDefinition`,
 * and enforcing something per request is what a plugin is for. It sits with its peers now — `sse`,
 * `cache`, `apiInit` and `mailer` are core plugins for the same reason.
 *
 * It used to be `augmentCORS` in the config chain plus `handleCORS` in `core/handlers/`: two
 * halves of one idea, filed apart, with core naming both. The augment is gone rather than moved —
 * it defaulted `$trustedOrigins` for a single reader, which defaults it itself now (as
 * `panel.$access` does).
 */
export const cors = definePlugin(() => {
  return {
    name: 'cors',
    handler: handleCORS
  } as const satisfies Plugin;
});
