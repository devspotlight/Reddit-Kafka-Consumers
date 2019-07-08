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

## Database

Required db schema to write to:
```redshift
CREATE TABLE reddit_comments(
    id BIGINT IDENTITY(1, 1),
    banned_by VARCHAR(255),
    no_follow BOOLEAN,
    link_id VARCHAR(10),
    gilded BOOLEAN,
    author VARCHAR(255),
    author_verified BOOLEAN,
    author_comment_karma INT,
    author_link_karma INT,
    num_comments INT,
    created_utc INT,
    score INT,
    over_18 BOOLEAN,
    body VARCHAR(65535),
    downs INT,
    is_submitter BOOLEAN,
    num_reports INT,
    controversiality INT,
    quarantine BOOLEAN,
    ups INT,
    is_bot BOOLEAN,
    is_troll BOOLEAN,
    recent_comments VARCHAR(65535),
    is_training BOOLEAN
);
```
> NOTE: This is [Redshift flavored SQL](https://docs.aws.amazon.com/redshift/latest/dg/c_SQL_reference.html).

## Running

`node index.js`
