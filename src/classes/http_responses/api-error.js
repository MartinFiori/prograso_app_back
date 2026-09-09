class ApiError extends Error {
  constructor({ data, statusCode, description, errorCode = null, isOperational = true } = {}) {
    super(description);

    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.description = description;
    this.errorCode = errorCode;
    this.data = data;
    this.status = 'error';
    Error.captureStackTrace(this);
  }

  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  }

  description(description) {
    this.description = description;
    return this;
  }

  data(data) {
    this.data = data;
    return this;
  }

  code(errorCode) {
    this.errorCode = errorCode;
    return this;
  }
}

module.exports = ApiError
