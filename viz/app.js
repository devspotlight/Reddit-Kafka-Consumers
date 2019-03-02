/* eslint no-console:0 */

const path = require('path')
const server = require('http').createServer()
const { spawn } = require('child_process')
const WebSocketServer = require('ws').Server
const express = require('express')
const basicAuth = require('express-basic-auth')
const webpack = require('webpack')
const history = require('connect-history-api-fallback')
const webpackDev = require('webpack-dev-middleware')

const webpackConfig = require('./webpack.config')
const Consumer = require('./consumer')
const app = express()
const constants = require('./consumer/constants')
let dataGeneratorProcess = null

const Postgres = require('pg-promise')({
  capSQL: true
})
const db = Postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432')
const query = Postgres.helpers.concat([
  { query: new Postgres.QueryFile('./sql/truncate.sql', { minify: true }) },
  {
    query: new Postgres.QueryFile('./sql/load.sql', { minify: true }),
    values: [process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY]
  }
])
db.connect()

const PRODUCTION = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3000

/*
 * Configure web app and webpack pieces
 */
app.use('/public', express.static(path.join(__dirname, 'public')))

// Configure admin routes
const auth = basicAuth({
  // TODO: Use .env for secrets
  users: { '': process.env.ADMIN_PASSWORD || 'ultrasecret' },
  challenge: true,
  realm: 'Kafka Stream Visualization Admin'
})

app.get('/admin/reload', auth, (req, res) => {
  return db
    .none(query)
    .then(() => res.send(`Fixture data truncated and reloaded.`))
    .catch((error) => res.send(`ERROR: ${error}`))
})

app.get('/admin/start', auth, (req, res) => {
  if (dataGeneratorProcess) {
    return res.send('Already running. Restart Heroku `web` process to stop.')
  } else {
    dataGeneratorProcess = spawn('node', ['index.js', '-c', 'kafka.js'], {
      cwd: path.resolve(process.cwd(), '..', 'generate_data')
    })

    dataGeneratorProcess.on('error', (err) => {
      console.log(`Failed to start data generator: ${err}`)
      dataGeneratorProcess = null
    })
    dataGeneratorProcess.on('close', (code) => {
      console.log(`Data generator process stopped with code ${code}.`)
      dataGeneratorProcess = null
    })
    dataGeneratorProcess.stdout.on('data', (data) =>
      console.log(`data generator stdout: ${data}`)
    )
    dataGeneratorProcess.stderr.on('data', (data) =>
      console.log(`data generator stderr: ${data}`)
    )
    res.send('Data generator started.')
  }
})

app.get('/admin/kill', auth, (req, res) => {
  if (dataGeneratorProcess) {
    dataGeneratorProcess.kill('SIGHUP')
    dataGeneratorProcess = null
    return res.send('Kill signal sent to data generator.')
  } else {
    return res.send('Data generator not running.')
  }
})

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
 * Configure WebSocketServer to send as broadcast callback into Kafka consumer.
 */
const wss = new WebSocketServer({ server })

/*
 * Configure Kafka consumer
 */
const consumer = new Consumer({
  broadcast: (data) =>
    wss.clients.forEach((client) => client.send(JSON.stringify(data))),
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
