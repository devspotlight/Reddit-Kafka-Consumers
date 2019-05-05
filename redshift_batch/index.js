const Postgres = require('pg-promise')({
    capSQL: true
});
const Config = require('getconfig');
const Kafka = require('no-kafka');
const { performance } = require('perf_hooks');

const db = Postgres(Config.database);
db.connect();
const ecommTable = new Postgres.helpers.ColumnSet([
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
  messageSet.forEach((msg) => {
    const now = performance.now();
    const sinceLast = now - lastUpdate;
    const value = JSON.parse(msg.message.value);
    const offset = msg.offset;
    const length = queue.push(value);

    if (lock === false && (length >= Config.queueSize || sinceLast > Config.timeout)) {
      console.debug('queue.length', queue.length);
      lock = true;
      lastUpdate = now;
      const query = Postgres.helpers.insert(queue, ecommTable);
      db.query(query, queue)
        .then(() => {
          return consumer.commitOffset({ topic, partition, offset });
        })
        .then(() => {
          lock = false;
          console.debug('unlock');
        })
        .catch((err) => {
          lock = false;
          console.debug('err', err);
        });
      queue = [];
    }
  });
};


consumer.init().then(() => {
  consumer.subscribe(Config.kafka.topic, dataHandler);
});

