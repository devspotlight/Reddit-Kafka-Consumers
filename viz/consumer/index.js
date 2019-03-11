/* eslint no-console: 0 */

const Kafka = require('no-kafka') // See https://github.com/oleksiyk/kafka
const moment = require('moment') // See http://momentjs.com/docs/

/**
 * Kafka Consumer class
 * @type {module.Consumer}
 */
module.exports = class Consumer {
  /**
   * Constructs a Kafka consumer that will process the data stream?
   * @param interval    Used to set up the consumer.
   * @param broadcast   Callback to send data processed by the consumer to.
   * @param topic       Used as clientId option for no-kafka SimpleConsumer class.
   * @param consumer    See remaining no-kafka SimpleConsumerOptions interface in
   *                    https://github.com/oleksiyk/kafka/blob/ec699b07482c829d6b04d920e5ff669fe9461b55/types/simple_consumer.d.ts#L11
   */
  constructor({ broadcast, interval, topic, consumer }) {
    this._broadcast = broadcast
    this._interval = interval

    // this.startTime = null
    // this.latestTime = null
    // this.categories = {}

    // See https://github.com/oleksiyk/kafka/tree/8a0802a53ddaf30747cfb735ee689376c5d51f8a#simpleconsumer
    this._consumer = new Kafka.SimpleConsumer({
      idleTimeout: this._interval,
      connectionTimeout: 10 * 1000,
      clientId: topic,
      ...consumer
    })
  }

  /**
   * Initializes Kafka consumer
   * by subscribing topic to `onMessage`
   * @returns {Bluebird<number>} this consumer (promise)
   */
  init() {
    const { _consumer: consumer } = this
    const { clientId: topic } = consumer.options

    return consumer
      .init()
      .then(() => consumer.subscribe(topic, this.onMessage.bind(this)))
    // TODO: bind predictBotOrTroll here instead of calling from onMessage?
  }

  /**
   * Prepares the Kafka message data. (Subscribed to Kafka topic in `init`)
   * @param messageSet set of latest messages from Kafka topic
   */
  onMessage(messageSet) {
    const items = messageSet.map((m) =>
      this.predictBotOrTroll(JSON.parse(m.message.value.toString('utf8')))
    )
    console.debug('Consumer.onMessage items', items)

    this._broadcast(items)
  }

  /**
   * Mock ML API method
   * @param data Reddit comment data from Kafka topic
   * @returns {{datetime: moment.Moment, troll_score: number, comment: *, bot_score: number, username}}
   */
  predictBotOrTroll(data) {
    return {
      datetime: moment.unix(data.created_utc).format('MMM Do HH:mm:ss z'),
      username: data.author,
      comment: data.body,
      troll_score: 0.5,
      bot_score: 0.5
    }
  }
}
