const express = require("express");
const router = express.Router();
const multer = require("multer");

const petController = require("../controllers/pet.controller");
const petValidator = require("../validations/pet.validator");

// Configure multer for in-memory uploads (buffers)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept all file types for all supported fields
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: fileFilter,
});

// Middleware for handling file uploads
const uploadFiles = (fields) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.fields(fields);
    uploadMiddleware(req, res, function (err) {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      next();
    });
  };
};

// Image resizing will be handled in the controller using buffers

// Add Pet
router.post(
  "/addPet",
  uploadFiles([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'vaccinationFiles', maxCount: 5 }
  ]),
  petValidator.create,
  petController.createPet
);

// Get All Pets
router.get(
  "/getAllPets",
  petController.getAllPets
);

// Get Pet by ID
router.get(
  "/:id",
  petController.getPetById
);

// Update Pet
router.put(
  "/:id",
  uploadFiles([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'vaccinationFiles', maxCount: 5 }
  ]),
  petValidator.update,
  petController.updatePet
);

// Delete Pet (Soft Delete)
router.delete(
  "/:id",
  petController.deletePet
);

// Get pet statistics
router.get(
  "/stats/overview",
  petController.getPetStats
);

// Stream media file from GridFS
router.get(
  "/media/:gridFsId",
  petController.getMediaFile
);

// Get pets by userId
router.get(
  "/user/:userId",
  petController.getPetsByUserId
);

module.exports = router;