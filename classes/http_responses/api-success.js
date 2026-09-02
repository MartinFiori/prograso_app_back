const { OK } = require('../../constants/http-status-codes')

class ApiSuccess {
  constructor({ data, statusCode = OK, description = 'OK' }) {
    this.data = data;
    this.statusCode = statusCode;
    this.description;
    this.status = 'success'
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