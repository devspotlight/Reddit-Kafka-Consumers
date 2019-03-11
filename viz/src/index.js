import '../styles/style.css'

// TODO Consider adding http://square.github.io/crossfilter/

// import Nav from './lib/nav'
// import Stream from './lib/stream'
// import { MAX_SIZE, MAX_BUFFER_SIZE, INTERVAL } from '../consumer/constants'

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

// Combines GUI elements (coupled to ../../views/index.pug) as GUI elements
const aggregate = [
  // new Nav('.footer-legend ul'),
  // new Stream({
  //   selector: '.chart-stream .chart',
  //   transition: INTERVAL,
  //   x: 'time',
  //   y: 'avgPerSecond',
  //   maxSize: MAX_BUFFER_SIZE,
  //   maxDisplaySize: MAX_SIZE
  // })
]

const url = `ws${window.location.href.match(/^http(s?:\/\/.*)\/.*$/)[1]}`
const ws = new window.WebSocket(url)

// Initialize GUI elements
aggregate.forEach((a) => a.init())

ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  /* eslint no-console:1 */ console.log(data)

  // Update all GUI elements with websocket data stream
  aggregate.forEach((a) => a.update(data))
}
