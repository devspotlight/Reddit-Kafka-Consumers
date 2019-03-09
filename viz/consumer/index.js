const Kafka = require('no-kafka') // See https://github.com/oleksiyk/kafka
const Moment = require('moment') // See http://momentjs.com/docs/

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
  constructor({ interval, broadcast, topic, consumer }) {
    this._broadcast = broadcast
    this._interval = interval

    this.startTime = null
    this.latestTime = null
    this.categories = {}

    // See https://github.com/oleksiyk/kafka/tree/8a0802a53ddaf30747cfb735ee689376c5d51f8a#simpleconsumer
    this._consumer = new Kafka.SimpleConsumer({
      idleTimeout: this._interval,
      connectionTimeout: 10 * 1000,
      clientId: topic,
      ...consumer
    })
  }

  init() {
    const { _consumer: consumer } = this
    const { clientId: topic } = consumer.options

    return consumer
      .init()
      .then(() => consumer.subscribe(topic, this.onMessage.bind(this)))
      .then(() => setInterval(this.cullAndBroadcast.bind(this), this._interval))
  }

  onMessage(messageSet) {
    const items = messageSet
      .map((m) => JSON.parse(m.message.value.toString('utf8')))
      .filter(({ action }) => action === 'WISHLIST')

    for (const item of items) {
      const time = Moment(item.time)

      if (!this.categories.hasOwnProperty(item.category)) {
        if (this.startTime === null) {
          this.startTime = time
        }

        this.categories[item.category] = {
          id: item.category,
          times: [],
          first: time,
          count: 0
        }
      }
      this.categories[item.category].times.push(time)
      this.categories[item.category].count++
      if (this.latestTime === null || time.isAfter(this.latestTime)) {
        this.latestTime = time.clone()
      }
    }
  }

  cullAndBroadcast() {
    const items = []
    for (const category of Object.keys(this.categories)) {
      const collate = this.categories[category]
      const cullFrom = this.latestTime.clone().subtract(60, 'seconds')
      let idx = 0
      let cullCount = 0
      do {
        if (
          !Moment.isMoment(collate.times[idx]) ||
          collate.times[idx].isBefore(cullFrom)
        ) {
          cullCount++
        } else {
          break
        }
        idx++
      } while (idx < collate.times.length)
      for (idx = 0; idx < cullCount; idx++) {
        collate.times.shift()
      }

      let timeRange = 60
      let avgPerSecond = 0
      if (this.latestTime !== null && collate.times.length > 0) {
        if (collate.first.isAfter(cullFrom)) {
          timeRange = this.latestTime.diff(collate.times[0], 'seconds')
        }
        avgPerSecond = collate.times.length / timeRange
      }
      items.push({
        id: collate.id,
        count: collate.count,
        avgPerSecond: avgPerSecond
      })
    }
    const time = new Date().valueOf()
    this._broadcast({
      data: items.reduce((res, cat) => {
        res[cat.id] = [{ ...cat, time }]
        return res
      }, {})
    })
  }
}
