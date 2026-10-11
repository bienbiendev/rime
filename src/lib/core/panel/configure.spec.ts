import { describe, expect, it } from 'vitest';
import { configurePanel } from './configure.js';

const Banner = (() => null) as any;

describe('configurePanel', () => {
  it('keeps every component the config names and defaults the header', () => {
    const config = configurePanel({ panel: { components: { collectionHeader: [Banner] } } } as any);
    expect(config.panel.components).toEqual({ collectionHeader: [Banner], header: [] });
  });

  it('gives a config with no components only the header', () => {
    expect(configurePanel({} as any).panel.components).toEqual({ header: [] });
  });
});
