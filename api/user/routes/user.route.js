const express = require("express");
const router = express.Router();
const multer = require("multer");

const userController = require("../controllers/user.controller");
const userValidator = require("../validations/user.validator");

// single file in memory (profile image)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Register (accepts optional profile image)
router.post(
  "/register",
  upload.single('profileImage'),
  userValidator.register,
  userController.register
);

// Login
router.post(
  "/login",
  userValidator.login,
  userController.login
);

// Get user by ID (no password)
router.get(
  "/:id",
  userValidator.getById,
  userController.getById
);

// Update user by ID
router.put(
  "/:id",
  userValidator.update,
  userController.update
);

module.exports = router;


