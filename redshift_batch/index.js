const Postgres = require('pg-promise')({
    capSQL: true
});
const Config = require('getconfig');
const Kafka = require('no-kafka');
const { performance } = require('perf_hooks');

const db = Postgres(Config.database);
db.connect();
const commentsTable = new Postgres.helpers.ColumnSet([
  'author_link_karma',
  'author_comment_karma',
  'author_created_at',
  'author_verified',
  'author_has_verified_email',
  'subreddit_id',
  'approved_at_utc',
  'edited',
  'mod_reason_by',
  'banned_by',
  'author_flair_type',
  'removal_reason',
  'link_id',
  'author_flair_template_id',
  'likes',
  'banned_at_utc',
  'mod_reason_title',
  'gilded',
  'archived',
  'no_follow',
  'author',
  'num_comments',
  'score',
  'over_18',
  'controversiality',
  'body',
  'link_title',
  'downs',
  'is_submitter',
  'subreddit',
  'num_reports',
  'created_utc',
  'quarantine',
  'subreddit_type',
  'ups',
  'is_bot',
  'is_troll',
  'recent_comments',
  'is_training'
], {table: 'reddit_comments'});

const consumer = new Kafka.SimpleConsumer({
  ...Config.kafka.config,
  groupId: Config.kafka.group
});

let queue = [];
let lastUpdate = performance.now();
let lock = false;

const dataHandler = (messageSet, topic, partition) => {
  console.debug('redshift_batch: handling', messageSet.length, 'messages from', topic, partition)
  messageSet.forEach((msg) => {
    const now = performance.now();
    const sinceLast = now - lastUpdate;
    const value = JSON.parse(msg.message.value);
    console.debug('redshift_batch:   queueing comment', value.link_id, value.created_utc)
    const offset = msg.offset;
    // console.debug('redshift_batch:   processing msg at', offset)
    const length = queue.push(value);
    // console.debug('redshift_batch: queue length', length)

    // Executes a `query` with the cumulative `queue` of row values every time the db is not locked.
    if (lock === false && (length >= Config.queueSize || sinceLast > Config.timeout)) {
      console.debug('redshift_batch:   inserting', queue.length, 'message rows to Redshift');
      lock = true;
      lastUpdate = now;
      const query = Postgres.helpers.insert(queue, commentsTable);
      db.query(query, queue)
        .then(() => {
          return consumer.commitOffset({ topic, partition, offset });
        })
        .then(() => {
          lock = false;
          // console.debug('redshift_batch:   unlock');
        })
        .catch((err) => {
          lock = false;
          // console.debug('redshift_batch:   err', err);
        });
      queue = [];
    }
    // TODO: What if the db is locked during the last n messages when the loop ends? Will those rows get inserted?
  });
};


consumer.init().then(() => {
  consumer.subscribe(Config.kafka.topic, dataHandler);
});

