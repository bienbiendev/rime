import { createPlaywrightConfig } from '../playwright.config.base';

// Each file writes and reads its own documents, so three files run at once
export default createPlaywrightConfig({ name: 'fields', workers: 3 });
