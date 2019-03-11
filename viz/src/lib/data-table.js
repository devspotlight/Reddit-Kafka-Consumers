/* eslint no-console: 0 */

import * as d3 from 'd3' // See https://d3js.org/

export default class DataTable {
  /**
   * Constructs a data table instance
   * @param tableSelector string to select target <table> element
   * @param selector
   * @param maxSize
   */
  constructor(selector, maxSize) {
    /*
     * Target table
     */
    this.tbody = d3.select(selector)
    console.log('Selected tbody', this.tbody)
    /*
     * Max number of rows in the table
     */
    this._maxSize = maxSize
  }

  /**
   * See `aggregate` usage in ../../src/index.js
   */
  init() {
    /*
     * Actual rows of data
     */
    this.row_data = []
  }

  /**
   * Appends data rows to the bottom of the table,
   * removing the oldest beyond the max
   * @param data
   */
  update(data) {
    // Append most recent data to table rows.
    this.row_data.push(...data)

    if (this.row_data.length >= this._maxSize) {
      this.row_data.splice(0, this.row_data.length - this._maxSize)
    }
    // Bind data rows to target table
    let rows = this.tbody.selectAll('tr').data(this.row_data, (d) => d)

    rows.exit().remove()

    let tr = rows.enter().append('tr')
    tr.append('td').text((data) => data.datetime)
    tr.append('td').text((data) => data.username)
    tr.append('td').text((data) => `${data.comment.slice(0, 10)}...`)
    tr.append('td').text((data) => data.troll_score)
    tr.append('td').text((data) => data.bot_score)

    // Scroll to bottom of table div
    let tableDiv = d3.select('.data-table').node()
    tableDiv.scrollTop = tableDiv.scrollHeight

    console.log(this._maxSize, this.row_data.length, this.row_data.slice(0))
  }
}
