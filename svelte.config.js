import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess({
    postcss: true
  }),

  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  },

  kit: {
    adapter: adapter(),
    alias: {
      'rimecms/panel/*': './src/lib/panel/*',
      'rimecms/panel': './src/lib/panel/index.js',
      'rimecms/server': './src/lib/server.js',
      'rimecms/config/server': './src/lib/core/config/server/index.server.js',
      'rimecms/config': './src/lib/core/config/client/index.js',
      'rimecms/fields/rich-text': './src/lib/fields/rich-text/client.js',
      'rimecms/fields/relation': './src/lib/fields/relation/client.js',
      $lib: './src/lib',
      rimecms: './src/lib'
    }
  }
};

export default config;
