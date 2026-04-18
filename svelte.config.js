import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    alias: {
      'rimecms/panel/auth/client': './src/lib/panel/pages/auth/index.js',
      'rimecms/panel/auth': './src/lib/panel/pages/auth/index.server.js',
      'rimecms/panel/client': './src/lib/panel/index.js',
      'rimecms/panel': './src/lib/panel/index.server.js',
      'rimecms/panel/*': './src/lib/panel/*',
      'rimecms/i18n': './src/lib/core/i18n',
      'rimecms/api': './src/lib/core/api/index.server.js',
      'rimecms/config/server': './src/lib/core/config/server/index.server.js',
      'rimecms/config/client': './src/lib/core/config/client/index.js',
      'rimecms/fields/rich-text': './src/lib/fields/rich-text/client.js',
      $lib: './src/lib',
      rimecms: './src/lib'
    }
  }
};

export default config;
