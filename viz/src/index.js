import '../styles/style.css'

import Stream from './lib/stream'
import Nav from './lib/nav'
import { MAX_SIZE, MAX_BUFFER_SIZE, INTERVAL } from '../consumer/constants'

// Combines Nav and Stream objects (coupled to ../../views/index.pug)
const aggregate = [
  new Nav('.footer-legend ul'),
  new Stream({
    selector: '.chart-stream .chart',
    transition: INTERVAL,
    x: 'time',
    y: 'avgPerSecond',
    maxSize: MAX_BUFFER_SIZE,
    maxDisplaySize: MAX_SIZE
  })
]

const url = `ws${window.location.href.match(/^http(s?:\/\/.*)\/.*$/)[1]}`
const ws = new window.WebSocket(url)

// Initialize elements (Nav and Stream)
aggregate.forEach((a) => a.init())

ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  /* eslint no-console:1 */ console.log(data)

  // Update elements (Nav and Stream) with every websocket message
  aggregate.forEach((a) => a.update(data))
}
