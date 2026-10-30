import { PANEL_AUTH_IMAGE } from '#lib/core/constants.server.js';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh working folder, and a fresh module: the lookup is made once per module. */
const inFolder = async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rime-auth-image-'));
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  vi.resetModules();
  const { panelAuthImage } = await import('./image.server.js');
  /** Writes the image under `folder`, as the app or its build holds it. */
  const addImage = (folder: string) => {
    const file = path.join(dir, folder, PANEL_AUTH_IMAGE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '');
  };
  return { panelAuthImage, addImage };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('panelAuthImage', () => {
  it('answers the image the build copied to build/client', async () => {
    const { panelAuthImage, addImage } = await inFolder();
    addImage('build/client');
    expect(panelAuthImage()).toBe(PANEL_AUTH_IMAGE);
  });

  it('answers the image of static/', async () => {
    const { panelAuthImage, addImage } = await inFolder();
    addImage('static');
    expect(panelAuthImage()).toBe(PANEL_AUTH_IMAGE);
  });

  it('answers null without an image, and does not look again', async () => {
    const { panelAuthImage, addImage } = await inFolder();
    expect(panelAuthImage()).toBeNull();
    addImage('static');
    expect(panelAuthImage()).toBeNull();
  });
});
