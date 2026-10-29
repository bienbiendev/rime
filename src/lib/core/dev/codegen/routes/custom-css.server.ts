import { logger } from '#lib/core/logger.server.js';
import fs from 'fs';

/**
 * Adds a `<svelte:head>` linking the stylesheet `cssPath` (config.panel.css) right after the first
 * `</script>` of the layout at `layoutFilePath`, in place. Runs once on a freshly written layout:
 * a second call adds a second link.
 */
export function injectCustomCSS(layoutFilePath: string, cssPath: string): void {
  try {
    if (fs.existsSync(layoutFilePath)) {
      const content = fs.readFileSync(layoutFilePath, 'utf8');

      // Insert a svelte:head tag after the script tag
      const scriptEndIndex = content.indexOf('</script>') + '</script>'.length;
      if (scriptEndIndex > 0) {
        const beforeScript = content.substring(0, scriptEndIndex);
        const afterScript = content.substring(scriptEndIndex);
        const cssLink = `\n\n<svelte:head>\n  <link rel="stylesheet" href="${cssPath}" />\n</svelte:head>`;

        const newContent = beforeScript + cssLink + afterScript;

        // Write the updated content back to the file
        fs.writeFileSync(layoutFilePath, newContent, 'utf8');
        logger.debug(`Custom CSS link added in ${layoutFilePath}`);
      } else {
        logger.error(`Could not find insertion point in ${layoutFilePath}`);
      }
    } else {
      logger.error(`Layout file not found: ${layoutFilePath}`);
    }
  } catch (err) {
    logger.error(`Error injecting custom CSS into layout file: ${err}`);
  }
}
