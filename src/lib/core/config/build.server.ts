import type { SMTPConfig } from '$lib/core/plugins/mailer/module.server.js';
import { configureConfig } from './configure.js';
import { withPrototypeLists } from './build.js';
import { resolvePipelines } from '$lib/core/pipeline/build.server.js';
import { createRime, type Rime } from '../rime.server.js';
import { configurePlugins } from '$lib/core/plugins/configure.js';
import type { Config } from './types.js';

export const buildConfig = <const C extends Config>(config: C): Promise<Rime<C>> => {
  const output = augmentConfig(config);
  return createRime(output as any as BuildConfig<C>);
};

/**
 * The config chain, one named step at a time:
 *
 * 1. `withPrototypeLists` — `collections` and `areas` exist, empty if the author named none.
 * 2. `configureConfig` — the five whole-config steps, in `config/configure.ts`.
 * 3. `resolvePipelines` — every prototype config's `$hooks`, last, so a derived config is
 *    resolved by the same line as an authored one.
 * 4. `configurePlugins` — the plugin layer, over the config the rest of rime will see.
 *
 * A literal sequence rather than a loop, which `inference.spec.ts` guards: the narrowing at each
 * step is what carries the slug literals through to `event.locals.rime`.
 */
function augmentConfig<T extends Config>(config: T) {
  const withLists = withPrototypeLists(config);
  const configured = configureConfig(withLists);
  // Last, and after the features: every prototype config that exists by now — authored or derived
  // — has its pipeline resolved by the same step.
  const withPipelines = resolvePipelines(configured);
  const output = configurePlugins(withPipelines);
  return output;
}

type InferCollections<C> = C extends { collections?: readonly any[] }
  ? {
      [
        K in NonNullable<C['collections']>[number] as K extends { slug: infer N }
          ? N extends string
            ? N
            : never
          : never
      ]: K;
    }
  : Record<string, never>;

type InferAreas<C> = C extends { areas?: readonly any[] }
  ? {
      [
        K in NonNullable<C['areas']>[number] as K extends { slug: infer N }
          ? N extends string
            ? N
            : never
          : never
      ]: K;
    }
  : Record<string, never>;

type InferCollectionsSlug<C> = C extends { collections?: readonly any[] }
  ? NonNullable<C['collections']>[number] extends { slug: infer N }
    ? N extends string
      ? N
      : never
    : never
  : Array<never>;

type InferAreasSlug<C> = C extends { areas?: readonly any[] }
  ? NonNullable<C['areas']>[number] extends { slug: infer N }
    ? N extends string
      ? N
      : never
    : never
  : Array<never>;

type InferCorePlugins<C extends Config> = {
  cache: import('$lib/core/plugins/cache/module.server.js').CacheActions;
  sse: import('$lib/core/plugins/sse/module.server.js').SSEActions;
} & (C['$smtp'] extends SMTPConfig
  ? { mailer: import('$lib/core/plugins/mailer/module.server.js').MailerActions }
  : Record<string, never>);

// Helper type to extract custom plugins from original config
type ExtractCustomPlugins<C> = C extends { plugins: readonly (infer P)[] }
  ? P extends { name: infer N; actions?: infer A }
    ? N extends string
      ? Record<N, NonNullable<A>>
      : never
    : never
  : Record<string, never>;

type InferPluginsServer<C extends Config> = InferCorePlugins<C> & ExtractCustomPlugins<C>;

export type BuildConfig<C extends Config = Config> = ReturnType<typeof augmentConfig<C>> & {
  readonly $InferAuthPlugins: C['$auth'] extends { plugins: any } ? C['$auth']['plugins'] : [];
  readonly $InferRoutes: C['$routes'] extends Record<string, any> ? C['$routes'] : unknown;
  readonly $InferPluginsServer: InferPluginsServer<C>;
  readonly $InferCollections: InferCollections<C>;
  readonly $InferAreas: InferAreas<C>;
  readonly $InferAreasSlug: InferAreasSlug<C>;
  readonly $InferCollectionsSlug: InferCollectionsSlug<C>;
};
