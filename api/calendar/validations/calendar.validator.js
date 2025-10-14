const { body, validationResult } = require("express-validator");

exports.create = [
  body("user_id")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isMongoId()
    .withMessage("must be a valid ObjectId"),
  body("type")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isIn(["availability", "request"])
    .withMessage("must be either 'availability' or 'request'"),
  body("start_date")
    .notEmpty()
    .withMessage("is required")
    .isISO8601()
    .withMessage("must be a valid date"),
  body("end_date")
    .notEmpty()
    .withMessage("is required")
    .isISO8601()
    .withMessage("must be a valid date"),
  body("status")
    .optional()
    .trim()
    .isIn(["available", "requested", "booked", "cancelled", "in_review"])
    .withMessage("must be one of: available, requested, booked, cancelled, in_review"),
  body("pets")
    .optional()
    .isArray()
    .withMessage("must be an array"),
  body("pets.*")
    .optional()
    .isMongoId()
    .withMessage("each pet ID must be a valid ObjectId"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("must not exceed 500 characters"),
  body("neighbor_distance_range")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("must be between 1 and 50"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      var error_message = [];
      errors.array().forEach(function (errorsList) {
        error_message.push(errorsList.param + " " + errorsList.msg);
      });
      res.status(400).json({
        success: false,
        message: error_message,
      });
    } else {
      // Additional validation for type-specific fields
      const { type, pets, reason, neighbor_distance_range } = req.body;
      
      if (type === 'request') {
        if (!pets || pets.length === 0) {
          return res.status(400).json({
            success: false,
            message: ["pets is required for request type"],
          });
        }
        if (!reason) {
          return res.status(400).json({
            success: false,
            message: ["reason is required for request type"],
          });
        }
      } else if (type === 'availability') {
        // neighbor_distance_range is optional for availability type
        // if (!neighbor_distance_range) {
        //   return res.status(400).json({
        //     success: false,
        //     message: ["neighbor_distance_range is required for availability type"],
        //   });
        // }
      }
      
      next();
    }
  },
];

exports.update = [
  body("user_id")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty")
    .isMongoId()
    .withMessage("must be a valid ObjectId"),
  body("type")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty")
    .isIn(["availability", "request"])
    .withMessage("must be either 'availability' or 'request'"),
  body("start_date")
    .optional()
    .notEmpty()
    .withMessage("cannot be empty")
    .isISO8601()
    .withMessage("must be a valid date"),
  body("end_date")
    .optional()
    .notEmpty()
    .withMessage("cannot be empty")
    .isISO8601()
    .withMessage("must be a valid date"),
  body("status")
    .optional()
    .trim()
    .isIn(["available", "requested", "booked", "cancelled", "in_review"])
    .withMessage("must be one of: available, requested, booked, cancelled, in_review"),
  body("pets")
    .optional()
    .isArray()
    .withMessage("must be an array"),
  body("pets.*")
    .optional()
    .isMongoId()
    .withMessage("each pet ID must be a valid ObjectId"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("must not exceed 500 characters"),
  body("neighbor_distance_range")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("must be between 1 and 50"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      var error_message = [];
      errors.array().forEach(function (errorsList) {
        error_message.push(errorsList.param + " " + errorsList.msg);
      });
      res.status(400).json({
        success: false,
        message: error_message,
      });
    } else {
      next();
    }
  },
];
