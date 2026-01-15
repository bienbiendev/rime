const autoprefixer = require('autoprefixer');
const mixins = require('postcss-mixins');

const config = {
	plugins: [
		mixins({
			mixinsFiles: ['./src/lib/site/styles/*.mixins.css'],
			mixinsDir: ['./src/lib/panel/style/mixins', './src/lib/site/styles/mixins']
		}),
		autoprefixer
	]
};

module.exports = config;
