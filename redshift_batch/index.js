const Postgres = require('pg-promise')({
    capSQL: true
})
const Config = require('getconfig')
const Kafka = require('no-kafka')
const { performance } = require('perf_hooks')

const db = Postgres(Config.database)
db.connect()
// console.debug('Connected to', Config.database, 'db') // NOTE: This output contains secrets
const commentsColumns = new Postgres.helpers.ColumnSet([
  'banned_by',
  'no_follow',
  'link_id',
  'gilded',
  'author',
  'author_verified',
  'author_comment_karma',
  'author_link_karma',
  'num_comments',
  'created_utc',
  'score',
  'over_18',
  'body',
  'downs',
  'is_submitter',
  'num_reports',
  'controversiality',
  'quarantine',
  'ups',
  'is_bot',
  'is_troll',
  'recent_comments',
  'is_training'
], {table: 'reddit_comments'})

const consumer = new Kafka.SimpleConsumer({
  ...Config.kafka.config,
  groupId: Config.kafka.group
})

let queue = []
let lastUpdate = performance.now()
let lock = false

const dataHandler = (messageSet, topic, partition) => {
  console.debug('redshift_batch: handling', messageSet.length, 'messages from', topic, partition)
  messageSet.forEach((msg) => {
    const now = performance.now()
    const sinceLast = now - lastUpdate
    const value = JSON.parse(msg.message.value)
    const offset = msg.offset
    const length = queue.push(value)
    console.debug('redshift_batch:   queueing comment', value.link_id, value.created_utc)
    // console.debug('redshift_batch:   processing msg at', offset)
    // console.debug('redshift_batch: queue length', length)

    // TODO: console.info only if NODE_ENV !== 'production'
    // Executes a `query` with the cumulative `queue` of row values every time the below process is not locked.
    if (lock === false && (length >= Config.queueSize || sinceLast > Config.timeout)) {
      console.debug('redshift_batch:   inserting', queue.length, 'message row(s) to db')
      // console.debug('redshift_batch:   messages to insert:\n', queue)
      lock = true
      lastUpdate = now
      try {
        // See http://vitaly-t.github.io/pg-promise/helpers.html#.insert
        const query = Postgres.helpers.insert(queue, commentsColumns)
        // console.debug('redshift_batch:   insert query:', query)
        db.query(query)
          .then(() => {
            return consumer.commitOffset({topic, partition, offset})
            // NOTE: A committed offset indicates that all messages up to this offset have been processed.
          })
          .then(() => {
            lock = false
            // console.debug('redshift_batch:   unlock')
          })
          .catch((err) => {
            lock = false
            console.error('redshift_batch:   db query error!', err)
          })
      } catch(err) {
        console.error('redshift_batch: dataHandler error!', err)
        console.error('redshift_batch: batch query skipped!', queue.length)
        lock = false
      }
      queue = []
    }
    // TODO: What if the db is locked during the last n messages when the loop ends? Will those rows get inserted?
  })
}


consumer.init().then(() => {
  consumer.subscribe(Config.kafka.topic, dataHandler)
})

