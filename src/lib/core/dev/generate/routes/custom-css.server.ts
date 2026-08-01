import { logger } from '$lib/core/logger/index.server.js';
import fs from 'fs';

/**
 * Injects a custom CSS link into the layout file
 * @param layoutFilePath Path to the layout file
 * @param cssPath Custom CSS path from config
 * @example
 * // Inject custom CSS into a layout file
 * const layoutPath = '/path/to/src/routes/(rime)/+layout.svelte';
 * const cssPath = '/assets/custom-styles.css';
 * injectCustomCSS(layoutPath, cssPath);
 * // This will add a <svelte:head> tag with a link to the CSS file
 */
export function injectCustomCSS(layoutFilePath: string, cssPath: string): void {
  try {
    if (fs.existsSync(layoutFilePath)) {
      const content = fs.readFileSync(layoutFilePath, 'utf8');

      // Check if the file already has a svelte:head tag
      if (content.includes('<svelte:head>')) {
        // Check if the CSS link is already in the file
        if (content.includes(cssPath)) {
          return; // CSS link already exists
        }

        // Replace the existing svelte:head tag with a new one that includes the CSS link
        const headRegex = /(<svelte:head>)(.*?)(<\/svelte:head>)/s;
        const cssLink = `\n  <link rel="stylesheet" href="${cssPath}" />\n  `;
        const newContent = content.replace(headRegex, `$1$2${cssLink}$3`);

        // Write the updated content back to the file
        fs.writeFileSync(layoutFilePath, newContent, 'utf8');
        logger.info(`Custom CSS link added in ${layoutFilePath}`);
      } else {
        // No svelte:head tag, so insert one after the script tag
        const scriptEndIndex = content.indexOf('</script>') + '</script>'.length;
        if (scriptEndIndex > 0) {
          const beforeScript = content.substring(0, scriptEndIndex);
          const afterScript = content.substring(scriptEndIndex);
          const cssLink = `\n\n<svelte:head>\n  <link rel="stylesheet" href="${cssPath}" />\n</svelte:head>`;

          const newContent = beforeScript + cssLink + afterScript;

          // Write the updated content back to the file
          fs.writeFileSync(layoutFilePath, newContent, 'utf8');
          logger.info(`Custom CSS link added in ${layoutFilePath}`);
        } else {
          logger.error(`Could not find insertion point in ${layoutFilePath}`);
        }
      }
    } else {
      logger.error(`Layout file not found: ${layoutFilePath}`);
    }
  } catch (err) {
    logger.error(`Error injecting custom CSS into layout file: ${err}`);
  }
}

/**
 * Removes any custom CSS link from the layout file
 * @param layoutFilePath Path to the layout file
 * @example
 * // Remove custom CSS from a layout file
 * const layoutPath = '/path/to/src/routes/(rime)/+layout.svelte';
 * removeCustomCSS(layoutPath);
 * // This will remove any <svelte:head> tag and its contents from the layout file
 */
export function removeCustomCSS(layoutFilePath: string): void {
  try {
    if (fs.existsSync(layoutFilePath)) {
      let content = fs.readFileSync(layoutFilePath, 'utf8');

      if (content.includes('<svelte:head>')) {
        // Remove the svelte:head tag and its contents
        const headRegex = /<svelte:head>.*?<\/svelte:head>/s;
        content = content.replace(headRegex, '');

        // Write the updated content back to the file
        fs.writeFileSync(layoutFilePath, content, 'utf8');
        logger.info(`[✓] Custom CSS link removed from ${layoutFilePath}`);
      }
    } else {
      logger.error(`Layout file not found: ${layoutFilePath}`);
    }
  } catch (err) {
    logger.error(`Error removing custom CSS from layout file: ${err}`);
  }
}
