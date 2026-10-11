import { describe, expect, it } from 'vitest';
import buildNavigation from './panel-navigation.js';

// `buildNavigation` reads only the user and the panel URL builder off the event
const event = {
  locals: { user: { roles: ['admin'] }, rime: { routes: { panelUrl: (p = '') => `/panel/${p}` } } }
} as any;

const area = (slug: string, panel: unknown) =>
  ({ slug, kebab: slug, label: slug, panel, access: { read: () => true } }) as any;

describe('buildNavigation', () => {
  it('files a custom route without a group under none', () => {
    const config = {
      collections: [],
      areas: [],
      panel: { routes: { stats: { label: 'Stats' } } }
    } as any;
    expect(buildNavigation(config, event).none).toEqual([
      { title: 'Stats', icon: 'custom-stats', url: '/panel/stats' }
    ]);
  });

  it('leaves out an area with panel: false, and lists the others', () => {
    const config = {
      collections: [],
      areas: [area('settings', false), area('infos', undefined)],
      panel: { routes: {} }
    } as any;
    expect(buildNavigation(config, event).areas).toEqual([
      { title: 'infos', icon: 'infos', url: '/panel/infos' }
    ]);
  });
});
