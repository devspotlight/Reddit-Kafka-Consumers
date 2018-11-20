/* eslint no-console:0 */

const path = require('path')
const fs = require('fs')
const server = require('http').createServer()
const WebSocketServer = require('ws').Server
const express = require('express')
const webpack = require('webpack')
const history = require('connect-history-api-fallback')
const webpackDev = require('webpack-dev-middleware')

const webpackConfig = require('./webpack.config')
const Consumer = require('./consumer')
const app = express()
const constants = require('./consumer/constants')

const PRODUCTION = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3000

/*
 * Configure web app and webpack pieces
 *
 */
app.use('/public', express.static(path.join(__dirname, 'public')))

if (PRODUCTION) {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'dist/index.html'))
  )
} else {
  app.use(history({ verbose: false }))
  app.use(webpackDev(webpack(webpackConfig), { stats: 'minimal' }))
}

server.on('request', app)

/*
 * Configure WebSocketServer
 *
 */
const wss = new WebSocketServer({ server })

/*
 * Configure Kafka consumer
 *
 */
const consumer = new Consumer({
  broadcast: (data) =>
    wss.clients.forEach((client) => client.send(JSON.stringify(data))),
  interval: constants.INTERVAL,
  topic: constants.KAFKA_TOPIC,
  consumer: {
    connectionString: process.env.KAFKA_URL.replace(/\+ssl/g, ''),
    ssl: {
      cert: fs.readFileSync(path.resolve(__dirname, 'client.crt')).toString(),
      key: fs.readFileSync(path.resolve(__dirname, 'client.key')).toString()
    }
  }
})

consumer
  .init()
  .catch((err) => {
    console.error(`Consumer could not be initialized: ${err}`)
    if (PRODUCTION) throw err
  })
  .then(() => {
    server.listen(PORT, () =>
      console.log(`http/ws server listening on http://localhost:${PORT}`)
    )
  })
