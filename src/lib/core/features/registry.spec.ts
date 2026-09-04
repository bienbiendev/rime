import { describe, expect, it } from 'vitest';
import { prototypes } from '$lib/core/prototype/registry.js';
import { configureOrder } from './registry.js';

/**
 * `configureOrder` is a hand-written tuple of names, because the type fold needs an order and the
 * prototype registry is annotated so that no feature's hooks reach `BuildConfig`. That makes it
 * the one thing here able to drift from what actually runs, and drift is silent: the config would
 * be typed as if a feature's `configure` had not run, or had run somewhere else.
 *
 * So: assert the tuple against the real registry, in the real order.
 */
describe('configureOrder', () => {
  const running = [
    ...new Map(
      prototypes
        .flatMap((prototype) => prototype.features)
        .map((feature) => [feature.name, feature])
    ).values()
  ]
    .filter((feature) => feature.configure)
    .map((feature) => feature.name);

  it('lists every feature that carries a configure, in the order they run', () => {
    expect(running).toEqual([...configureOrder]);
  });
});
