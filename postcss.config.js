import autoprefixer from 'autoprefixer';
import path from 'path';
import postcssImport from 'postcss-import';
import mixins from 'postcss-mixins';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: [
    postcssImport(),
    mixins({
      mixinsFiles: [path.join(__dirname, './src/lib/site/styles/*.mixins.css')],
      mixinsDir: [
        path.join(__dirname, './src/lib/panel/style/mixins'),
        path.join(__dirname, './src/lib/site/styles/mixins')
      ]
    }),
    autoprefixer
  ]
};

export default config;
