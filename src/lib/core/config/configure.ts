import { configureCors } from '$rime/modules:core/cors';
import { configureStaff } from '$rime/modules:core/auth';
import { configureUploadDirectories } from '$rime/modules:core/prototype/collection/upload';
import { configureVersions } from '$rime/modules:core/prototype/shared/versions';
import { configureAuthTables } from '#lib/core/auth/configure.js';
import { configurePanel } from '#lib/core/panel/configure.js';
import type { BuiltConfig } from './types.js';
import type { Dic } from '#lib/util/types.js';

/**
 * Everything that shapes the **whole** config, in the order it runs.
 *
 * The twin of a prototype's `augments` list, at the other scope: an augment shapes one prototype
 * config, these six shape the config itself. Two steps depend on the order:
 *
 * - **staff before panel.** The panel's icon map covers the collections that exist when it runs,
 *   and `staff` has to be one of them.
 * - **panel before upload and versions.** Those two *derive* collections — `<slug>Directories`,
 *   `$<slug>__versions` — and a derived collection has no place in the panel's navigation.
 *
 * Four of the six come through `$rime/modules`. `configureVersions` and `configureCors` are
 * server-only and resolve to `undefined` on a client build; the `step ? … : current` guard skips
 * them.
 *
 * The type is declared rather than inferred, and that is load-bearing. `bootRime<C>` reads
 * `config.panel.language` while `C` is still a type parameter; an intersection built from a key
 * union stays deferred there and `panel` never resolves. A concrete `Pick` is decidable at once.
 */
export const configureConfig = <T extends Dic>(
  config: T
): T & Pick<BuiltConfig, 'panel' | 'icons' | '$trustedOrigins' | '$tables'> =>
  [
    configureStaff,
    configureAuthTables,
    configurePanel,
    configureUploadDirectories,
    configureVersions,
    configureCors
  ].reduce(
    // `any` for the same reason a prototype's augments list is: each step names the shape it
    // needs, and a list holding several cannot promise any of them that shape.
    (current: Dic, step: ((config: any) => any) | undefined) => (step ? step(current) : current),
    config
  ) as unknown as T & Pick<BuiltConfig, 'panel' | 'icons' | '$trustedOrigins' | '$tables'>;
