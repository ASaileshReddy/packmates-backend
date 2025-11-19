const express = require("express");
const router = express.Router();

const calendarController = require("../controllers/calendar.controller");
const calendarValidator = require("../validations/calendar.validator");

// Create Calendar Entry
router.post(
  "/addCalendarEntry",
  calendarValidator.create,
  calendarController.createCalendarEntry
);

// Get All Calendar Entries
router.get(
  "/getAllCalendarEntries",
  calendarController.getAllCalendarEntries
);

// Get all request type entries - MUST come before /:id
router.get(
  "/requests/all",
  calendarController.getAllRequests
);

// Get all availability type entries - MUST come before /:id
router.get(
  "/availability/all",
  calendarController.getAllAvailability
);

// Get Calendar Entry by ID
router.get(
  "/:id",
  calendarController.getCalendarEntryById
);

// Update Calendar Entry
router.put(
  "/:id",
  calendarValidator.update,
  calendarController.updateCalendarEntry
);

// Delete Calendar Entry (Hard Delete)
router.delete(
  "/:id",
  calendarController.deleteCalendarEntry
);

// Soft Delete Calendar Entry
router.patch(
  "/:id/soft-delete",
  calendarController.softDeleteCalendarEntry
);

// Get Calendar Statistics
router.get(
  "/stats/overview",
  calendarController.getCalendarStats
);

// Filter by Type
router.get(
  "/filter/type",
  calendarController.filterByType
);

// Filter by Status
router.get(
  "/filter/status",
  calendarController.filterByStatus
);

// Filter by User
router.get(
  "/filter/user",
  calendarController.filterByUser
);

// Unified Filter
router.get(
  "/filter/all",
  calendarController.filter
);

// Find Matching Availability for Request
router.get(
  "/matching/:request_id",
  calendarController.findMatchingAvailability
);

// Get calendar entries by user ID
router.get(
  "/user/:user_id",
  calendarController.getCalendarEntriesByUserId
);

module.exports = router;
