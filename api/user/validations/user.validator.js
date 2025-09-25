const { body, validationResult, param } = require("express-validator");
const response = require("../../../response");

exports.register = [
  body("firstname").trim().notEmpty().withMessage("is required").isLength({ min: 2, max: 100 }).withMessage("must be between 2 and 100 characters"),
  body("lastname").trim().notEmpty().withMessage("is required").isLength({ min: 2, max: 100 }).withMessage("must be between 2 and 100 characters"),
  body("email").trim().notEmpty().withMessage("is required").isEmail().withMessage("must be a valid email").normalizeEmail(),
  body("password").notEmpty().withMessage("is required").isLength({ min: 6 }).withMessage("must be at least 6 characters"),
  body("dob").optional().isISO8601().withMessage("must be a valid date"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array().map(e => `${e.param} ${e.msg}`);
      return res.status(400).json({ success: false, message: error_message });
    }
    next();
  }
];

exports.login = [
  body("email").trim().notEmpty().withMessage("is required").isEmail().withMessage("must be a valid email").normalizeEmail(),
  body("password").notEmpty().withMessage("is required"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array().map(e => `${e.param} ${e.msg}`);
      return res.status(400).json({ success: false, message: error_message });
    }
    next();
  }
];

exports.getById = [
  param("id").isMongoId().withMessage("must be a valid MongoDB ObjectId"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array().map(e => `${e.param} ${e.msg}`);
      return res.status(400).json({ success: false, message: error_message });
    }
    next();
  }
];

exports.update = [
  param("id").isMongoId().withMessage("must be a valid MongoDB ObjectId"),
  body("firstname").optional().trim().isLength({ min: 2, max: 100 }).withMessage("must be between 2 and 100 characters"),
  body("lastname").optional().trim().isLength({ min: 2, max: 100 }).withMessage("must be between 2 and 100 characters"),
  body("email").optional().trim().isEmail().withMessage("must be a valid email").normalizeEmail(),
  body("mobilenumber").optional().trim().isLength({ min: 5, max: 20 }).withMessage("must be 5-20 chars"),
  body("address").optional().trim().isLength({ max: 300 }).withMessage("must be <= 300 chars"),
  body("city").optional().trim().isLength({ max: 100 }).withMessage("must be <= 100 chars"),
  body("state").optional().trim().isLength({ max: 100 }).withMessage("must be <= 100 chars"),
  body("zip").optional().trim().isLength({ max: 20 }).withMessage("must be <= 20 chars"),
  body("dob").optional().isISO8601().withMessage("must be a valid date"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error_message = errors.array().map(e => `${e.param} ${e.msg}`);
      return res.status(400).json({ success: false, message: error_message });
    }
    next();
  }
];


