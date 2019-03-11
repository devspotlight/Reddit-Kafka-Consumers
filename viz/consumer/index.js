const Kafka = require('no-kafka') // See https://github.com/oleksiyk/kafka
// const Moment = require('moment') // See http://momentjs.com/docs/

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
   * Initializes Kafka consumer,
   * subscribing topic to `onMessage` and returning `cullAndBroadcast` to on `this._interval`
   * @returns {Bluebird<number>} this consumer (promise)
   */
  init() {
    const { _consumer: consumer } = this
    const { clientId: topic } = consumer.options

    return consumer
      .init()
      .then(() => consumer.subscribe(topic, this.onMessage.bind(this)))
  }

  /**
   * Subscribed to Kafka topic. Prepares the Kafka message data
   * @param messageSet set of latest messages from Kafka topic
   */
  onMessage(messageSet) {
    const items = messageSet.map((m) =>
      JSON.parse(m.message.value.toString('utf8'))
    )
    // /* eslint no-console:1 */ console.debug('Consumer.onMessage items', items)

    this._broadcast(items)
  }
}
