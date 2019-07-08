/* eslint no-console: 0 */

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
const unirest = require('unirest')
const moment = require('moment') // See http://momentjs.com/docs/

const app = express()
const PRODUCTION = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3000

/*
 * Configure and run web app (server)
 */
app.use('/public', express.static(path.join(__dirname, 'public')))

// Web app files consists of static web page dist/index.html (bundled with webpack)
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

/**
 * Web socket server for broadcasting predicted comments (taken from Kafka).
 * @type {WebSocketServer}
 */
const wss = new WebSocketServer({ server })

/**
 * Kafka consumer
 * Will broadcast JSON (assumed) messages to all wss clients
 * @type {module.Consumer}
 */
const consumer = new Consumer({
  broadcast: (msgs) => {
    // console.debug(`consumer: Broadcast ${msgs.length} msgs`, msgs)
    predictBotOrTrolls(msgs)
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

/**
 * Applies ML web service for user class prediction (normal/bot/troll)
 * @todo API URL hardcoded https://botidentification.herokuapp.com
 * @param msgs messages to predict user class for
 */
function predictBotOrTrolls(msgs) {
  // console.debug('consumer:', msgs.length, msgs)

  /**
   * Keeps predictions in order after async POST to web service
   * @type {Array}
   */
  let predictions = []

  msgs.forEach(
    /**
     * forEach callback to predict user class for each message
     * @param msg message from Kafka
     * @param m `msg` index
     */
    (msg, m) => {
      if (msg.is_training) {
        console.info(
          'msg handler: skipping training msg',
          msg.link_id,
          msg.is_bot ? '(bot)' : '',
          msg.is_troll ? '(troll)' : ''
        )
        return
      }
      // Whitelists `msg` property values into expected format.
      const data = {
        banned_by: msg.banned_by,
        no_follow: msg.no_follow ? 1 : 0,
        link_id: msg.link_id,
        gilded: msg.gilded ? 1 : 0,
        author: msg.author,
        author_verified: msg.author_verified ? 1 : 0,
        author_comment_karma: msg.author_comment_karma,
        author_link_karma: msg.author_link_karma,
        num_comments: msg.num_comments,
        created_utc: msg.created_utc,
        score: msg.score,
        over_18: msg.over_18 ? 1 : 0,
        body: msg.body,
        downs: msg.downs,
        is_submitter: msg.is_submitter ? 1 : 0,
        num_reports: msg.num_reports,
        controversiality: msg.controversiality ? 1 : 0,
        quarantine: msg.quarantine ? 1 : 0,
        ups: msg.ups,
        recent_comments: msg.recent_comments
      }

      // Integrates ML web service.
      // // console.debug(
      // //   'msg handler: POSTing to botidentification.herokuapp.com:',
      // //   data
      // // )
      // console.debug(
      //   'msg handler: POSTing to botidentification.herokuapp.com (partial data):',
      //   {
      //     link_id: msg.link_id,
      //     author: msg.author,
      //     author_verified: msg.author_verified ? 1 : 0,
      //     created_utc: msg.created_utc,
      //     body20: `${msg.body.slice(0, 27)}...`,
      //     controversiality: msg.controversiality ? 1 : 0,
      //     recent_comments_len: JSON.parse(msg.recent_comments).length
      //   }
      // )
      unirest
        .post('https://botidentification.herokuapp.com/')
        .type('json')
        .send(data)
        .end((res) => {
          if (2 == res.statusType) {
            console.info(
              'msg handler: res.body for',
              msg.author,
              msg.link_id,
              msg.created_utc,
              res.body
            )
          } else {
            // res.statusType: 2 = Ok, 5 = Server Error
            console.error(
              `msg handler: BAD response (HTTP ${
                res.code
              }) after POST call to https://botidentification.herokuapp.com/`
            )
            console.error('with msg (partial data)', {
              link_id: msg.link_id,
              author: msg.author,
              author_verified: msg.author_verified ? 1 : 0,
              created_utc: msg.created_utc,
              body20: `${msg.body.slice(0, 27)}...`,
              controversiality: msg.controversiality ? 1 : 0,
              recent_comments_len: JSON.parse(msg.recent_comments).length
            })
            // console.debug('and body', res.body)
          }

          predictions[m] = 2 == res.statusType ? res.body : { prediction: null }
          predictions[m].username = msg.author
          predictions[m].comment_prev = `${msg.body.slice(0, 200)}...`
          predictions[m].datetime = moment
            .unix(msg.created_utc)
            .format('MMM Do HH:mm:ss z')
          predictions[m].link_hash = msg.link_id.slice(3)

          // Determine behavior and whitelist ML API replies (hardcoded)
          switch (predictions[m].prediction) {
            case 'normal user':
              predictions[m].behavior = 'normal user'
              break
            case 'possible bot':
              predictions[m].behavior = 'possible bot'
              break
            case 'possible troll':
              predictions[m].behavior = 'possible troll'
              break
            case 'Classification error':
              predictions[m].behavior = 'not known' // Code for "Error! Look into ML API code/model."
              break
            default:
              predictions[m].behavior = 'unknown'
          }
          // console.debug('msg handler: prediction', m, predictions[m])

          // Push to WSS once all messages have been predicted.
          if (
            // Anon fn. below counts non-empty elements in `predictions`
            msgs.length == predictions.reduce((ac, cv) => (cv ? ac + 1 : ac), 0)
          ) {
            // console.debug(`msg handler: Pushing ${msgs.length} predictions to WSS at msg ${m}`)
            wss.clients.forEach((client) =>
              client.send(JSON.stringify(predictions))
            )
          }
        })
      //unirest.post
    }
  )
}

/*
 * Starts the Kafka consumer
 * TODO: This runs in the background independently of web server. Should be its own file/app?
 */
consumer
  .init()
  .catch((err) => {
    console.error(`consumer: Kafka connection could not be initialized: ${err}`)
    if (PRODUCTION) throw err
  })
  .then(() => {
    server.listen(PORT, () =>
      console.info(`consumer: HTTP/WSS listening on http://localhost:${PORT}`)
    )
  })
