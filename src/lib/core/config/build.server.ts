import type { SMTPConfig } from '$lib/core/plugins/mailer/module.server.js';
import { configureWithFeatures } from '../features/registry.js';
import { configureWithPrototypes, prototypes } from '$lib/core/prototype/registry.js';
import { createRime, type Rime } from '../rime.server.js';
import { augmentCORS } from './augment-cors.server.js';
import { augmentPlugins } from './augment-plugins.js';
import type { Config } from './types.js';

export const buildConfig = <const C extends Config>(config: C): Promise<Rime<C>> => {
  const output = augmentConfig(config);
  return createRime(output as any as BuildConfig<C>);
};

/**
 * The config chain: one step per layer, and no more.
 *
 * It used to name the features it ran — `augmentStaffServer`, `augmentIcons`, `augmentPanel`,
 * `augmentPanelAccess`, `makeVersionsCollectionsAliases` — which is the config factory knowing
 * which feature owns what, the inversion this restructure exists to remove. Each of those is now
 * its owner's `configure`, and what is left is the three layers in the order they apply:
 * prototypes define, features augment and extend, plugins augment.
 *
 * Still a literal sequence rather than a loop: `inference.spec.ts` guards that, and each step's
 * declared transform is what carries the slug literals forward (see features/register.ts).
 */
function augmentConfig<T extends Config>(config: T) {
  const withPrototypes = configureWithPrototypes(config);
  const withCORS = augmentCORS(withPrototypes);
  const withFeatures = configureWithFeatures(prototypes, withCORS);
  const output = augmentPlugins(withFeatures);
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
