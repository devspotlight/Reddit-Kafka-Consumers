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
 * @todo API URL hardcoded https://botidentification-comments.herokuapp.com
 * @param msgs messages to predict user class for
 */
function predictBotOrTrolls(msgs) {
  // console.debug('predictBotOrTrolls:', msgs.length, msgs)

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
        console.debug(
          'predictBotOrTrolls skipping training msg',
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
      // console.debug(
      //   'predictBotOrTrolls: POSTing to botidentification.herokuapp.com:',
      //   data
      // )
      // console.debug(
      //   'predictBotOrTrolls: POSTing to botidentification.herokuapp.com (partial data):',
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
          // console.debug(
          //   'predictBotOrTrolls: Data sent to https://botidentification.herokuapp.com/',
          //   JSON.stringify(data)
          // )

          if (2 != res.statusType) {
            // 2 = Ok 5 = Server Error
            console.error(
              `BAD response (HTTP ${
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
            // console.error('Response body', res.body)
          }
          // TODO: Handle errors?
          console.debug(
            'predictBotOrTrolls: res.body for ',
            msg.link_id,
            msg.created_utc,
            res.body
          )

          predictions[m] = 2 == res.statusType ? res.body : { prediction: null }
          predictions[m].username = msg.author
          // // DEBUG: Temporary!
          // if ('AutoModerator' == msg.author) {
          //   console.log(
          //     'AutoModerator POST data sent to ML API:',
          //     JSON.stringify(data)
          //   )
          //   predictions[m].reqJSONstr = JSON.stringify(data)
          // }
          predictions[m].comment_prev = `${msg.body.slice(0, 200)}...`
          predictions[m].datetime = moment
            .unix(msg.created_utc)
            .format('MMM Do HH:mm:ss z')
          predictions[m].link_hash = msg.link_id.slice(3)

          // Determine behavior
          switch (predictions[m].prediction) {
            case 'Is a normal user':
              predictions[m].behavior = 'normal'
              break
            case 'Is a Bot':
              predictions[m].behavior = 'bot'
              break
            case 'Is a Troll':
              predictions[m].behavior = 'troll'
              break
            default:
              predictions[m].behavior = 'unknown'
          }
          // console.debug('predictBotOrTrolls: prediction', m, predictions[m])

          // Push to wss once all messages have been predicted.
          // Anon fn. below counts non-empty elements in `predictions`
          if (
            msgs.length == predictions.reduce((ac, cv) => (cv ? ac + 1 : ac), 0)
          ) {
            // console.debug(m, `Pushing ${msgs.length} predictions to wss`)
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
    console.error(`Kafka consumer could not be initialized: ${err}`)
    if (PRODUCTION) throw err
  })
  .then(() => {
    server.listen(PORT, () =>
      console.info(`http/ws server listening on http://localhost:${PORT}`)
    )
  })
