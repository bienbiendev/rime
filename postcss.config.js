import autoprefixer from 'autoprefixer';
import path from 'path';
import postcssImport from 'postcss-import';
import mixins from 'postcss-mixins';
import { fileURLToPath } from 'url';
import { sizeFunction } from './src/lib/panel/style/postcss/size-function.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: [
    postcssImport(),
    mixins({
      mixinsDir: [path.join(__dirname, './src/lib/panel/style/mixins')]
    }),
    sizeFunction(),
    autoprefixer
  ]
};

export default config;
