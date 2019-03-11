module.exports = class Nav {
  /**
   * Constructs a data legend
   * @param legend container selector
   */
  constructor(legend) {
    this.legend = document.querySelector(legend)

    /*
     * Enable "Architecture" button (coupled to ../../views/index.pug)
     */
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
  }

  /**
   * See `aggregate` usage in ../../src/index.js
   */
  init() {}

  /**
   * Keeps data legends include all data topics received.
   * @param data
   */
  update(data) {
    Object.keys(data).forEach((topic, index) => {
      if (!this.legend.querySelector(`#topic-${topic}`)) {
        const li = document.createElement('li')
        li.textContent = topic
        li.setAttribute('id', `topic-${topic}`)
        li.classList.add(`color-${index + 1}`)
        this.legend.appendChild(li)
      }
    })
  }
}
