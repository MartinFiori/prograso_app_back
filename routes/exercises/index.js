const { Router } = require("express");
const router = Router();
const supabase = require("../../supabase");
const ApiSuccess = require("../../classes/http_responses/api-success");
const httpStatusCodes = require("../../constants/http-status-codes");
const buildApiError = require("../../utils/buildApiError");

router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("exercises").select();
  if (error) {
    res
      .status(httpStatusCodes.BAD_REQUEST)
      .json(
        buildApiError({
          statusCode: httpStatusCodes.BAD_REQUEST,
          description: error.message,
          data: error,
        }),
      );
  }
  let apiSuccess = new ApiSuccess({ data })
  res.status(apiSuccess.statusCode).json(apiSuccess)
});

module.exports = router;
