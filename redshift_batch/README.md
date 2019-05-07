# redshift\_batch

Batches kafka messages into redshift.

## Local development

Run:
`npm i`

Copy config/default.json to config/local.json and edit if needed. Example:
```json
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
        "cert": ""
      }
    }
  }
}
```

## Deployment
Copy config/default.json to production.json and edit if needed.
> TODO: The above doesn't seem to be necessary nor is it known whether it would have any effect.

## Database

Required db schema to write to:
```sql
CREATE TABLE reddit_comments(
    author_link_karma INT,
    author_comment_karma INT,
    author_created_at INT,
    author_verified BOOLEAN,
    author_has_verified_email BOOLEAN,
    subreddit_id VARCHAR(255),
    approved_at_utc INT,
    edited INT,
    mod_reason_by VARCHAR(255),
    banned_by VARCHAR(255),
    author_flair_type VARCHAR(255),
    removal_reason VARCHAR(MAX),
    link_id VARCHAR(255),
    author_flair_template_id VARCHAR(255),
    likes INT,
    banned_at_utc INT,
    mod_reason_title VARCHAR(MAX),
    gilded INT,
    archived BOOLEAN,
    no_follow BOOLEAN,
    author VARCHAR(255),
    num_comments INT,
    score INT,
    over_18 BOOLEAN,
    controversiality INT,
    body VARCHAR(MAX),
    link_title VARCHAR(MAX),
    downs INT,
    is_submitter BOOLEAN,
    subreddit VARCHAR(255),
    num_reports INT,
    created_utc INT,
    quarantine BOOLEAN,
    subreddit_type VARCHAR(255),
    ups INT,
    is_bot BOOLEAN,
    is_troll BOOLEAN,
    recent_comments VARCHAR(MAX),
    is_training BOOLEAN
);
```

## Running

`node index.js`
