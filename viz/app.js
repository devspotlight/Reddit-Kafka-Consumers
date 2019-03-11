/* eslint no-console:0 */

const path = require('path')
const server = require('http').createServer()
const WebSocketServer = require('ws').Server // See https://github.com/websockets/ws
const express = require('express')
const webpack = require('webpack')
const history = require('connect-history-api-fallback')
const webpackDev = require('webpack-dev-middleware')
const webpackConfig = require('./webpack.config')
const Consumer = require('./consumer')
const constants = require('./consumer/constants')

const app = express()
const PRODUCTION = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3000

/*
 * Configure and run web app
 */

app.use('/public', express.static(path.join(__dirname, 'public')))

/*
 * Web app consists of static web page dist/index.html (bundled with webpack)
 */
if (PRODUCTION) {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'dist/index.html'))
  )
} else {
  // For dev, we use the webpack-dev-middleware module for express
  app.use(history({ verbose: false }))
  app.use(webpackDev(webpack(webpackConfig), { stats: 'minimal' }))
}

server.on('request', app)

/*
 * Configure/start web socket server for callback into Kafka consumer.
 */
const wss = new WebSocketServer({ server })

/*
 * Configure Kafka consumer
 * Will broadcast JSON (assumed) messages to all wss clients
 */
const consumer = new Consumer({
  broadcast: (msg) => {
    /* eslint no-console:1 */ console.debug(`broadcast ${msg.length} msgs`, msg)
    wss.clients.forEach((client) => client.send(JSON.stringify(msg)))
  },
  interval: constants.INTERVAL,
  topic: constants.KAFKA_TOPIC,
  consumer: {
    connectionString: process.env.KAFKA_URL.replace(/\+ssl/g, ''),
    ssl: {
      cert: './client.crt',
      key: './client.key'
    }
  }
})

/*
 * Start Kafka consumer
 */
consumer
  .init()
  .catch((err) => {
    /* eslint no-console:1 */ console.error(
      `Consumer could not be initialized: ${err}`
    )
    if (PRODUCTION) throw err
  })
  .then(() => {
    server.listen(PORT, () =>
      /* eslint no-console:1 */ console.info(
        `http/ws server listening on http://localhost:${PORT}`
      )
    )
  })
