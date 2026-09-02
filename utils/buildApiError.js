const ApiError = require("../classes/http_responses/api-error");

function buildApiError({ statusCode, description, errorCode, data } = {}) {
  return new ApiError({ statusCode, description, errorCode, data });
}

module.exports = buildApiError
