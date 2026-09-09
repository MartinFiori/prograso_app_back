const { OK } = require('../../constants/http-status-codes')

class ApiSuccess {
  constructor({ data, statusCode = OK, description = 'OK', pagination, meta }) {
    this.data = data;
    this.statusCode = statusCode;
    this.description = description;
    this.status = 'success'
    if (pagination !== undefined) {
      this.pagination = pagination
    }
    if (meta !== undefined) {
      this.meta = meta
    }
  }
  status(statusCode) {
    this.statusCode = statusCode
    return this;
  }
  description(description) {
    this.description = description;
    return this
  }
  data(data) {
    this.data = data;
    return this
  }
}

module.exports = ApiSuccess;