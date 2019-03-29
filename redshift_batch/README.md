# redshift\_batch

Batches kafka messages into redshift.

## Install

`npm install`

Copy config/default.json to config/local.json then edit the production.json

```js
{
  "queueSize": 50, // number of msgs to queue up before inserting
  "timeout": 3000, // max time to queue before inserting
  "database": "postgres://fritzy@localhost:5432/fritzy", // pg connection string
  "kafka": {  
    "topic": "reddit-comments", // kafka topic
    "group": "redshift-batch", // consumer group id
    "config": { // no-kafka configuration object
      "kafkaHost": "kafka://localhost:9092",
      "ssl": {
        "key": "",
        "cert: ""
      }
    }
  }
}
```

redditcomments table schema:
    author_link_karma integer,
    author_comment_karma integer,
    author_created_at integer,
    author_verified boolean,
    author_has_verified_email boolean,
    subreddit_it text,
    approved_at_utc integer,
    edited integer,
    mod_reason_by text,
    banned_by text,
    author_flair_type text,
    removal_reason text,
    link_id text,
    author_flair_template_id text,
    likes integer,
    banned_at_utc integer,
    mod_reason_title text,
    gilded integer,
    archived boolean,
    no_follow boolean,
    author text,
    num_comments integer,
    score integer,
    over_18 boolean,
    controversiality integer,
    body text,
    link_title text,
    downs integer,
    is_submitter boolean,
    subreddit text,
    num_reports integer,
    created_utc integer,
    quarantine boolean,
    subreddit_type text,
    ups integer

## Running

`node index.js`
