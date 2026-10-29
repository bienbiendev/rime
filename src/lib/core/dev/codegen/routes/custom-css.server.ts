import { logger } from '#lib/core/logger.server.js';
import fs from 'fs';

/**
 * Adds a `<svelte:head>` linking the stylesheet `cssPath` (config.panel.css) right after the first
 * `</script>` of the layout at `layoutFilePath`, in place. Runs once on a freshly written layout:
 * a second call adds a second link.
 */
export function injectCustomCSS(layoutFilePath: string, cssPath: string): void {
  const content = fs.readFileSync(layoutFilePath, 'utf8');
  const insertAt = content.indexOf('</script>') + '</script>'.length;
  const cssLink = `\n\n<svelte:head>\n  <link rel="stylesheet" href="${cssPath}" />\n</svelte:head>`;
  fs.writeFileSync(layoutFilePath, content.slice(0, insertAt) + cssLink + content.slice(insertAt));
  logger.debug(`Custom CSS link added in ${layoutFilePath}`);
}
