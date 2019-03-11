module.exports = class Nav {
  /**
   * Constructs a data legend
   * @param legend container selector
   */
  constructor(legend) {
    this.legend = document.querySelector(legend)
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
