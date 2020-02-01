const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: __dirname + '/src/app.js',
  output: {
    filename: 'bundle.js',
	},
	plugins: [
    new HtmlWebpackPlugin({
      template: __dirname + '/src/index.html',
    }),
  ],
};