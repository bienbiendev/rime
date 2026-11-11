import { describe, expect, it } from 'vitest';
import { createLayer } from './layer.svelte.js';

const content = {} as Element;

/** The content mounts: the modal takes its level. Returns what unmounts it. */
function open(layer: ReturnType<typeof createLayer>) {
  return layer.raise(content) as () => void;
}

describe('createLayer', () => {
  it('puts each modal opened above the ones open before it', () => {
    const sheet = createLayer();
    const palette = createLayer();
    const closeSheet = open(sheet);
    const closePalette = open(palette);

    expect(sheet.level).toBe(0);
    expect(palette.level).toBe(1);

    closePalette();
    closeSheet();
  });

  it('opens the next modal above the one left open, whichever closed first', () => {
    const sheet = createLayer();
    const palette = createLayer();
    const dialog = createLayer();

    const closeSheet = open(sheet);
    const closePalette = open(palette);
    closeSheet();
    const closeDialog = open(dialog);
    expect(palette.level).toBe(1);
    expect(dialog.level).toBe(2);
    closeDialog();
    closePalette();

    const closeSheetAgain = open(sheet);
    const closePaletteAgain = open(palette);
    closePaletteAgain();
    const closeDialogAgain = open(dialog);
    expect(sheet.level).toBe(0);
    expect(dialog.level).toBe(1);
    closeDialogAgain();
    closeSheetAgain();
  });

  it('puts a modal opened again above the ones opened since', () => {
    const sheet = createLayer();
    const dialog = createLayer();

    const closeSheet = open(sheet);
    const closeDialog = open(dialog);
    closeSheet();
    const closeSheetAgain = open(sheet);

    expect(dialog.level).toBe(1);
    expect(sheet.level).toBe(2);

    closeSheetAgain();
    closeDialog();
  });

  it('keeps the level of a closed modal for its exit, and starts from 0 once all are closed', () => {
    const sheet = createLayer();
    const dialog = createLayer();

    const closeSheet = open(sheet);
    const closeDialog = open(dialog);
    closeDialog();
    closeSheet();
    expect(dialog.level).toBe(1);

    const closeDialogAgain = open(dialog);
    expect(dialog.level).toBe(0);
    closeDialogAgain();
  });
});
