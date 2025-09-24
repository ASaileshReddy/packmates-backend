const { body, validationResult } = require("express-validator");

exports.create = [
  body("ownerId")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isMongoId()
    .withMessage("must be a valid ObjectId"),
  body("petType")
    .trim()
    .notEmpty()
    .withMessage("is required"),
  body("breed")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("must be between 2 and 100 characters"),
  body("gender")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isIn(["Male", "Female"])
    .withMessage("must be Male or Female"),
  body("age.label")
    .trim()
    .notEmpty()
    .withMessage("is required")
    .isIn(["Puppy", "Kitten", "Young", "Adult", "Senior"])
    .withMessage("must be one of: Puppy, Kitten, Young, Adult, Senior"),
  body("age.months")
    .isInt({ min: 0, max: 300 })
    .withMessage("must be between 0 and 300 months"),
  body("weightKg")
    .isFloat({ min: 0.1, max: 200 })
    .withMessage("must be between 0.1 and 200 kg"),
  body("nutrition.description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("must not exceed 1000 characters"),
  body("media.videoUrl")
    .customSanitizer((v) => (v === '' || v === 'null' || v === 'undefined' ? undefined : v))
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("must be a valid URL"),
  body("vaccination.status")
    .optional()
    .isBoolean()
    .withMessage("must be true or false"),
  body("ongoingTreatment")
    .optional()
    .isBoolean()
    .withMessage("must be true or false"),
  body("behaviours")
    .optional()
    .isArray()
    .withMessage("must be an array"),
  body("behaviours.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("each behaviour must be between 1 and 50 characters"),

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

exports.update = [
  body("ownerId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty")
    .isMongoId()
    .withMessage("must be a valid ObjectId"),
  body("petType")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty"),
  body("breed")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("must be between 2 and 100 characters"),
  body("gender")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty")
    .isIn(["Male", "Female"])
    .withMessage("must be Male or Female"),
  body("age.label")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("cannot be empty"),
  body("age.months")
    .optional()
    .isInt({ min: 0, max: 300 })
    .withMessage("must be between 0 and 300 months"),
  body("weightKg")
    .optional()
    .isFloat({ min: 0.1, max: 200 })
    .withMessage("must be between 0.1 and 200 kg"),
  body("nutrition.description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("must not exceed 1000 characters"),
  body("media.videoUrl")
    .customSanitizer((v) => (v === '' || v === 'null' || v === 'undefined' ? undefined : v))
    .optional({ nullable: true, checkFalsy: true })
    .isURL()
    .withMessage("must be a valid URL"),
  body("vaccination.status")
    .optional()
    .isBoolean()
    .withMessage("must be true or false"),
  body("ongoingTreatment")
    .optional()
    .isBoolean()
    .withMessage("must be true or false"),
  body("behaviours")
    .optional()
    .isArray()
    .withMessage("must be an array"),
  body("behaviours.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("each behaviour must be between 1 and 50 characters"),

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