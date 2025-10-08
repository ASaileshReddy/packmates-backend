const express = require("express");
const router = express.Router();
const sitterController = require("../controllers/sitter.controller");

// Create sitter profile
router.post("/", sitterController.createSitter);

// Get all sitters with filters
router.get("/", sitterController.getSitters);

// Get available sitters for specific date/time
router.get("/available", sitterController.getAvailableSitters);

// Get sitter by ID
router.get("/:id", sitterController.getSitterById);

// Update sitter profile
router.put("/:id", sitterController.updateSitter);

// Delete sitter profile
router.delete("/:id", sitterController.deleteSitter);

module.exports = router;
