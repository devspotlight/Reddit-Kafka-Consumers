/* eslint no-console: 0 */

import '../styles/style.css'

// TODO: Consider adding http://square.github.io/crossfilter/

// import Nav from './lib/nav'
// import Stream from './lib/stream'
import DataTable from './lib/data-table'
import TrendGraph from './lib/trend-graph'

// import { MAX_SIZE, BUFFER_SIZE, INTERVAL } from '../consumer/constants'
import { MAX_SIZE, BUFFER_SIZE } from '../consumer/constants'

// Enable "Architecture" button (coupled to ../../views/index.pug)
let architectureLink = document.querySelector('.architecture-link')
let main = document.querySelector('main')
let architectureFrame = document.querySelector('.architecture-iframe')
architectureLink.addEventListener('click', () => {
  const isOpen = main.classList.contains('open')
  if (isOpen) {
    architectureFrame.removeAttribute('src')
    main.classList.remove('open')
  } else {
    architectureFrame.setAttribute(
      'src',
      '/public/kafka-diagram/kafka-diagram-v2.html'
    )
    main.classList.add('open')
  }
})

/*
 * Combines GUI elements into (coupled to ../../views/index.pug)
 */
const aggregate = [
  // new Nav('.footer-legend ul'),
  // new Stream({
  //   selector: '.chart-stream .chart',
  //   transition: INTERVAL,
  //   x: 'time',
  //   y: 'avgPerSecond',
  //   maxSize: BUFFER_SIZE,
  //   maxDisplaySize: MAX_SIZE
  // })
  new DataTable('.data-table table tbody', MAX_SIZE),
  new TrendGraph('#trend-graph', BUFFER_SIZE)
]

const url = `ws${window.location.href.match(/^http(s?:\/\/.*)\/.*$/)[1]}`
const ws = new window.WebSocket(url)

// Initialize GUI elements
aggregate.forEach((a) => a.init())

ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  console.log(data)

  // Update all GUI elements with websocket data stream
  aggregate.forEach((a) => a.update(data))
}
