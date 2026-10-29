// Based on https://github.com/ueberdosis/tiptap/tree/main/packages/extension-drag-handle
import type { ComputePositionConfig } from '@floating-ui/dom';

/** Beside the node's first line, centred on it. `absolute` places it in the plugin's wrapper. */
export const defaultComputePositionConfig: ComputePositionConfig = {
  placement: 'left',
  strategy: 'absolute'
};
