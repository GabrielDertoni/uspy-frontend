const path = require('path')
const dotenv = require('dotenv')
const webpack = require('webpack')

let env = {
	API_URL: process.env.NODE_ENV === 'development' ? 'https://dev.uspy.me' : 'https://prod.uspy.me'
}

if (process.env.LOCAL) {
	// Take care of environment variables configuration
	env = dotenv.config({
		path: process.env.NODE_ENV === 'development' ? path.join(__dirname, '.env.dev') : path.join(__dirname, '.env.prod') // choose right path depending of mode of execution
	}).parsed
}
const envKeys = Object.keys(env).reduce((prev, next) => {
	prev[`process.env.${next}`] = JSON.stringify(env[next])
	return prev
}, {})

// Options for development mode
const devOptions = {
	watchOptions: {
		poll: 1000 // polls every second
	},
	devServer: {
		historyApiFallback: true
	}
}

module.exports = Object.assign({
	entry: path.join(__dirname, 'src', 'index'),
	output: {
		filename: 'bundle.js',
		path: path.join(__dirname, 'build'),
		publicPath: '/static/'
	},
	module: {
		rules: [
			{
				test: /\.(ts|js)x?$/,
				exclude: /node_modules/,
				include: /src/,
				use: ['babel-loader', 'eslint-loader']
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/,
				use: ['file-loader']
			}
		]
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
		modules: [path.join(__dirname, 'node_modules'), path.join(__dirname, 'src')]
	},
	plugins: [
		new webpack.DefinePlugin(envKeys)
	]
},
(process.env.MODE === 'dev' ? devOptions : {})
)
