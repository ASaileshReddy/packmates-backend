const petModel = require('../models/pet.model');
const response = require('../../../response');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

var data;

exports.createPet = async (req, res) => {
  try {
    const request = req.body;

    // Check for duplicate pet name/breed combination for the same owner
    const duplicatePet = await petModel.findOne({
      breed: request.breed,
      ownerId: request.ownerId,
      isDeleted: false,
    });

    if (duplicatePet) {
      const data = { message: 'Pet with this breed already exists for this owner.' };
      return response.validation_error_message(data, res);
    }

    // Handle files: accept either multipart (req.files) or JSON base64 arrays
    let imageFiles = [];
    let videoFiles = [];
    let vaccinationFiles = [];

    if (req.files && (req.files.images || req.files.videos || req.files.vaccinationFiles)) {
      if (req.files.images) imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      if (req.files.videos) videoFiles = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
      if (req.files.vaccinationFiles) vaccinationFiles = Array.isArray(req.files.vaccinationFiles) ? req.files.vaccinationFiles : [req.files.vaccinationFiles];
    } else if (request.media || request.vaccination) {
      // JSON mode
      if (request.media && Array.isArray(request.media.images)) {
        imageFiles = request.media.images.map((f) => ({
          originalname: f.fileName || f.originalName || 'image',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeKB ? Math.round(f.fileSizeKB * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
      if (request.media && Array.isArray(request.media.videos)) {
        videoFiles = request.media.videos.map((f) => ({
          originalname: f.fileName || f.originalName || 'video',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeMB ? Math.round(f.fileSizeMB * 1024 * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
      if (request.vaccination && Array.isArray(request.vaccination.files)) {
        vaccinationFiles = request.vaccination.files.map((f) => ({
          originalname: f.fileName || f.originalName || 'file',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeKB ? Math.round(f.fileSizeKB * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
    }

    // Process image files
    // Setup GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });

    // Upload helpers
    const uploadToGridFS = async (file) => {
      return new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype });
        if (file.buffer) {
          stream.end(file.buffer, (err) => {
            if (err) return reject(err);
            resolve(stream.id);
          });
        } else {
          // no buffer (should not happen for JSON mode), just resolve null
          resolve(null);
        }
      });
    };

    const processedImages = await Promise.all(imageFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeKB: Math.max(1, Math.round(file.size / 1024)),
      status: "Completed",
      fileType: file.mimetype,
      uploadedAt: new Date(),
    })));

    // Process video files
    const processedVideos = await Promise.all(videoFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      status: "Completed",
      fileType: file.mimetype,
      uploadedAt: new Date(),
      url: null,
    })));

    // Process vaccination files
    const processedVaccinationFiles = await Promise.all(vaccinationFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeKB: Math.max(1, Math.round(file.size / 1024)),
      fileType: file.mimetype,
      status: "Completed",
      uploadedAt: new Date(),
    })));

    const shouldReplaceImages =
      (request.media && Object.prototype.hasOwnProperty.call(request.media, 'images')) ||
      (req.files && !!req.files.images);
    const shouldReplaceVideos =
      (request.media && Object.prototype.hasOwnProperty.call(request.media, 'videos')) ||
      (req.files && !!req.files.videos);
    const shouldReplaceVaccinationFiles =
      (request.vaccination && Object.prototype.hasOwnProperty.call(request.vaccination, 'files')) ||
      (req.files && !!req.files.vaccinationFiles);

    const finalImages = shouldReplaceImages
      ? processedImages
      : (petRec.media?.images || []);
    const finalVideos = shouldReplaceVideos
      ? processedVideos
      : (petRec.media?.videos || []);
    const finalVaccinationFiles = shouldReplaceVaccinationFiles
      ? processedVaccinationFiles
      : (petRec.vaccination?.files || []);

    // Normalize simple location (address only)
    const buildLocation = (loc) => {
      if (!loc) return undefined;
      return {
        address: loc.address || undefined,
        city: loc.city || undefined,
        zipCode: loc.zipCode || undefined,
      };
    };

    const petRec = await petModel.create({
      ownerId: request.ownerId,
      petType: request.petType,
      breed: request.breed,
      gender: request.gender,
      age: {
        label: request.age?.label,
        months: request.age?.months,
      },
      weightKg: request.weightKg,
      nutrition: {
        description: request.nutrition?.description || "",
      },
      overview: request.overview || "",
      personality: Array.isArray(request.personality)
        ? request.personality
        : (typeof request.personality === 'string' && request.personality.trim() !== ''
            ? [request.personality]
            : []),
      importantDates: {
        birthday: request.importantDates?.birthday || null,
        adoptionDay: request.importantDates?.adoptionDay || null,
      },
      location: buildLocation(request.location),
      media: {
        images: processedImages,
        videos: processedVideos,
        videoUrl: request.media?.videoUrl || "",
      },
      vaccination: {
        status: request.vaccination?.status || false,
        files: processedVaccinationFiles,
      },
      ongoingTreatment: request.ongoingTreatment || false,
      behaviours: request.behaviours || [],
      userId: request.userId || new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    if (petRec) {
      response.success_message(petRec, res);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      response.validation_error_message({ message: 'Validation error: ' + error.message }, res);
    } else if (error.name === 'MongoError' && error.code === 11000) {
      response.validation_error_message({ message: 'Pet with this breed already exists for this owner' }, res);
    } else {
      response.error_message(error.message, res);
    }
  }
};

exports.getAllPets = async (req, res) => {
  try {
    const request = req.query;
    let filter = {
      isDeleted: false,
    };

    // Filter by owner
    if (request.ownerId) {
      filter.ownerId = mongoose.Types.ObjectId.createFromHexString(request.ownerId);
    }

    // Filter by pet type
    if (request.petType) {
      filter.petType = request.petType;
    }

    // Filter by gender
    if (request.gender) {
      filter.gender = request.gender;
    }

    // Search by breed
    if (request.search) {
      filter.breed = { $regex: request.search, $options: 'i' };
    }

    const petRecordsCount = await petModel.find(filter).countDocuments();
    const petRecs = await petModel.find(filter)
      .sort({ _id: -1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Setup GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });

    // Helper function to fetch file content from GridFS
    const fetchFileContent = async (file) => {
      if (!file.gridFsId) return file;
      
      try {
        const downloadStream = bucket.openDownloadStream(file.gridFsId);
        const chunks = [];
        
        return new Promise((resolve, reject) => {
          downloadStream.on('data', (chunk) => chunks.push(chunk));
          downloadStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              ...file,
              fileContent: buffer.toString('base64')
            });
          });
          downloadStream.on('error', reject);
        });
      } catch (error) {
        console.error('Error fetching file content:', error);
        return file;
      }
    };

    // Process each pet record to include file contents
    for (let i = 0; i < petRecs.length; i++) {
      const pet = petRecs[i];
      
      // Fetch file contents for images
      if (pet.media && pet.media.images) {
        pet.media.images = await Promise.all(
          pet.media.images.map(fetchFileContent)
        );
      }

      // Fetch file contents for videos
      if (pet.media && pet.media.videos) {
        pet.media.videos = await Promise.all(
          pet.media.videos.map(fetchFileContent)
        );
      }

      // Fetch file contents for vaccination files
      if (pet.vaccination && pet.vaccination.files) {
        pet.vaccination.files = await Promise.all(
          pet.vaccination.files.map(fetchFileContent)
        );
      }

      pet.createdAt = new Date(pet.createdAt).toISOString();
      pet.updatedAt = new Date(pet.updatedAt).toISOString();
    }

    res.json({
      success: true,
      data: petRecs,
      count: petRecordsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getPetById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Pet ID format', res);
    }

    const petRec = await petModel.findOne({ _id: id, isDeleted: false });
    
    if (!petRec) {
      return response.error_message('Pet not found', res);
    }

    // Setup GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });

    // Helper function to fetch file content from GridFS
    const fetchFileContent = async (file) => {
      if (!file.gridFsId) return file;
      
      try {
        const downloadStream = bucket.openDownloadStream(file.gridFsId);
        const chunks = [];
        
        return new Promise((resolve, reject) => {
          downloadStream.on('data', (chunk) => chunks.push(chunk));
          downloadStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              ...file.toObject(),
              fileContent: buffer.toString('base64')
            });
          });
          downloadStream.on('error', reject);
        });
      } catch (error) {
        console.error('Error fetching file content:', error);
        return file;
      }
    };

    // Fetch file contents for images
    if (petRec.media && petRec.media.images) {
      petRec.media.images = await Promise.all(
        petRec.media.images.map(fetchFileContent)
      );
    }

    // Fetch file contents for videos
    if (petRec.media && petRec.media.videos) {
      petRec.media.videos = await Promise.all(
        petRec.media.videos.map(fetchFileContent)
      );
    }

    // Fetch file contents for vaccination files
    if (petRec.vaccination && petRec.vaccination.files) {
      petRec.vaccination.files = await Promise.all(
        petRec.vaccination.files.map(fetchFileContent)
      );
    }

    petRec.createdAt = new Date(petRec.createdAt).toISOString();
    petRec.updatedAt = new Date(petRec.updatedAt).toISOString();

    response.success_message(petRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.updatePet = async (req, res) => {
  try {
    const request = req.body;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Pet ID format', res);
    }

    // Check for duplicate pet breed (excluding current record)
    const duplicatePet = await petModel.findOne({
      breed: request.breed,
      ownerId: request.ownerId,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (duplicatePet) {
      const data = { message: 'Pet with this breed already exists for this owner.' };
      return response.validation_error_message(data, res);
    }

    const petRec = await petModel.findById(id);
    if (!petRec) {
      return response.error_message('Pet not found', res);
    }

    // Handle file uploads
    let imageFiles = [];
    let videoFiles = [];
    let vaccinationFiles = [];

    if (req.files && (req.files.images || req.files.videos || req.files.vaccinationFiles)) {
      if (req.files.images) imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      if (req.files.videos) videoFiles = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
      if (req.files.vaccinationFiles) vaccinationFiles = Array.isArray(req.files.vaccinationFiles) ? req.files.vaccinationFiles : [req.files.vaccinationFiles];
    } else if (request.media || request.vaccination) {
      if (request.media && Array.isArray(request.media.images)) {
        imageFiles = request.media.images.map((f) => ({
          originalname: f.fileName || f.originalName || 'image',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeKB ? Math.round(f.fileSizeKB * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
      if (request.media && Array.isArray(request.media.videos)) {
        videoFiles = request.media.videos.map((f) => ({
          originalname: f.fileName || f.originalName || 'video',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeMB ? Math.round(f.fileSizeMB * 1024 * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
      if (request.vaccination && Array.isArray(request.vaccination.files)) {
        vaccinationFiles = request.vaccination.files.map((f) => ({
          originalname: f.fileName || f.originalName || 'file',
          mimetype: f.fileType || 'application/octet-stream',
          size: f.fileSizeKB ? Math.round(f.fileSizeKB * 1024) : (f.fileContent ? Buffer.from(f.fileContent, 'base64').length : 0),
          buffer: f.fileContent ? Buffer.from(f.fileContent, 'base64') : undefined,
        }));
      }
    }

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });
    const uploadToGridFS = async (file) => {
      if (!file.buffer) {
        return new Promise((resolve, reject) => {
          const stream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype });
          stream.end(file.buffer || Buffer.alloc(0), (err) => {
            if (err) return reject(err);
            resolve(stream.id);
          });
        });
      }
      return new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype });
        stream.end(file.buffer, (err) => {
          if (err) return reject(err);
          resolve(stream.id);
        });
      });
    };

    const processedImages = await Promise.all(imageFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeKB: Math.max(1, Math.round(file.size / 1024)),
      status: "Completed",
      fileType: file.mimetype,
      uploadedAt: new Date(),
    })));

    const processedVideos = await Promise.all(videoFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      status: "Completed",
      fileType: file.mimetype,
      uploadedAt: new Date(),
      url: null,
    })));

    const processedVaccinationFiles = await Promise.all(vaccinationFiles.map(async (file) => ({
      fileName: file.originalname,
      gridFsId: await uploadToGridFS(file),
      fileSizeKB: Math.max(1, Math.round(file.size / 1024)),
      fileType: file.mimetype,
      status: "Completed",
      uploadedAt: new Date(),
    })));

    const updateData = {
      ownerId: request.ownerId !== undefined ? request.ownerId : petRec.ownerId,
      petType: request.petType !== undefined ? request.petType : petRec.petType,
      breed: request.breed !== undefined ? request.breed : petRec.breed,
      gender: request.gender !== undefined ? request.gender : petRec.gender,
      age: {
        label: request.age?.label !== undefined ? request.age.label : petRec.age?.label,
        months: request.age?.months !== undefined ? request.age.months : petRec.age?.months,
      },
      weightKg: request.weightKg !== undefined ? request.weightKg : petRec.weightKg,
      nutrition: {
        description: request.nutrition?.description !== undefined ? request.nutrition.description : (petRec.nutrition?.description || ""),
      },
      overview: request.overview !== undefined ? request.overview : (petRec.overview || ""),
      personality: (Array.isArray(request.personality)
        ? request.personality
        : (typeof request.personality === 'string'
            ? [request.personality]
            : undefined)) || (petRec.personality || []),
      importantDates: {
        birthday: request.importantDates?.birthday !== undefined ? request.importantDates.birthday : (petRec.importantDates?.birthday || null),
        adoptionDay: request.importantDates?.adoptionDay !== undefined ? request.importantDates.adoptionDay : (petRec.importantDates?.adoptionDay || null),
      },
      location: (() => {
        if (request.location === undefined) return petRec.location;
        const prev = (petRec.location && typeof petRec.location.toObject === 'function') ? petRec.location.toObject() : (petRec.location || {});
        return {
          address: request.location?.address !== undefined ? request.location.address : prev.address,
          city: request.location?.city !== undefined ? request.location.city : prev.city,
          zipCode: request.location?.zipCode !== undefined ? request.location.zipCode : prev.zipCode,
        };
      })(),
      media: {
        images: finalImages,
        videos: finalVideos,
        videoUrl: request.media?.videoUrl !== undefined ? request.media.videoUrl : (petRec.media?.videoUrl || ""),
      },
      vaccination: {
        status: request.vaccination?.status !== undefined ? request.vaccination.status : petRec.vaccination?.status,
        files: finalVaccinationFiles,
      },
      ongoingTreatment: request.ongoingTreatment !== undefined ? request.ongoingTreatment : petRec.ongoingTreatment,
      behaviours: request.behaviours !== undefined ? request.behaviours : (petRec.behaviours || []),
      userId: petRec.userId,
    };

    const updated_pet = await petModel.findByIdAndUpdate(id, updateData, { new: true });

    if (updated_pet) {
      const data = {
        message: 'Pet updated successfully',
        pet: updated_pet,
      };

      // Notifications removed

      return response.success_message(data, res);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error_message('Validation error: ' + error.message, res);
    } else if (error.name === 'MongoError' && error.code === 11000) {
      return response.error_message('Pet with this breed already exists for this owner', res);
    } else {
      return response.error_message('Internal server error: ' + error.message, res);
    }
  }
};

exports.deletePet = async (req, res) => {
  try {
    
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Pet ID format', res);
    }

    const results = await petModel.deleteOne({ _id: id });

    if (results) {
      var message = results.deletedCount > 0 ? 'Deleted Successfully' : 'Record Not Found';

      if (petModel) {
        let data = { message: message, deletedCount: results.deletedCount };

        // Notifications removed

        response.success_message(data, res);
      }
    }
  } catch (err) {
    let data = { message: err.message };
    response.validation_error_message(data, res);
  }
};

exports.softDelete = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Pet ID format', res);
    }

    const pet = await petModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } }
    );
    
    if (pet) {
      let data = {
        message: 'Pet has been Deleted Successfully',
        deletedCount: 1,
      };
      
      // Notifications removed
      response.success_message(data, res);
    }
  } catch (error) {
    data = { message: error.message };
    response.validation_error_message(data, res);
  }
};

// Filter by pet type
exports.filterByPetType = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.petType) {
      filter.petType = req.query.petType;
    }
    const petRec = await petModel.find(filter);
    response.success_message(petRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Filter by gender
exports.filterByGender = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.gender) {
      filter.gender = req.query.gender;
    }
    const petRec = await petModel.find(filter);
    response.success_message(petRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Filter by owner
exports.filterByOwner = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }
    const petRec = await petModel.find(filter);
    response.success_message(petRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Search pets by breed
exports.searchByBreed = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.breed) {
      filter.breed = { $regex: req.query.breed, $options: 'i' };
    }
    const petRec = await petModel.find(filter)
      .populate('ownerId', 'name email')
      .populate('userId', 'name email');
    response.success_message(petRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Get pet statistics
exports.getPetStats = async (req, res) => {
  try {
    const totalPets = await petModel.countDocuments({ isDeleted: false });
    const petsByType = await petModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$petType', count: { $sum: 1 } } }
    ]);
    const vaccinatedPets = await petModel.countDocuments({ 
      isDeleted: false, 
      'vaccination.status': true 
    });
    const malePets = await petModel.countDocuments({ 
      isDeleted: false, 
      gender: 'Male' 
    });
    const femalePets = await petModel.countDocuments({ 
      isDeleted: false, 
      gender: 'Female' 
    });

    const stats = {
      totalPets,
      petsByType,
      vaccinatedPets,
      malePets,
      femalePets,
      vaccinationRate: totalPets > 0 ? ((vaccinatedPets / totalPets) * 100).toFixed(2) : 0
    };

    response.success_message(stats, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Unified filter method
exports.filter = async (req, res) => {
  try {
    const request = req.query;
    let filter = {
      isDeleted: false,
    };

    // Filter by pet type
    if (request.petType) {
      filter.petType = request.petType;
    }

    // Filter by gender
    if (request.gender) {
      filter.gender = request.gender;
    }

    // Filter by breed (case-insensitive search)
    if (request.breed) {
      filter.breed = {
        $regex: request.breed,
        $options: 'i'
      };
    }

    // Filter by owner
    if (request.ownerId) {
      filter.ownerId = request.ownerId;
    }

    // Filter by vaccination status
    if (request.vaccinationStatus !== undefined) {
      filter['vaccination.status'] = request.vaccinationStatus === 'true';
    }

    // Filter by ongoing treatment
    if (request.ongoingTreatment !== undefined) {
      filter.ongoingTreatment = request.ongoingTreatment === 'true';
    }

    // Filter by age range
    if (request.minAge && request.maxAge) {
      filter['age.months'] = {
        $gte: parseInt(request.minAge),
        $lte: parseInt(request.maxAge)
      };
    }

    // Filter by weight range
    if (request.minWeight && request.maxWeight) {
      filter.weightKg = {
        $gte: parseFloat(request.minWeight),
        $lte: parseFloat(request.maxWeight)
      };
    }

    // Filter by specific pet IDs (comma-separated)
    if (request.pet) {
      const petIds = request.pet.split(',');
      const validObjectIds = [];
      const searchTerms = [];
      
      petIds.forEach(id => {
        if (mongoose.Types.ObjectId.isValid(id?.toString())) {
          validObjectIds.push(mongoose.Types.ObjectId.createFromHexString(id?.toString()));
        } else {
          // If not a valid ObjectId, treat as search term
          searchTerms.push(id);
        }
      });
      
      if (validObjectIds.length > 0 && searchTerms.length > 0) {
        // Both ObjectIds and search terms
        filter.$or = [
          { _id: { $in: validObjectIds } },
          { breed: { $regex: searchTerms.join('|'), $options: 'i' } }
        ];
      } else if (validObjectIds.length > 0) {
        // Only ObjectIds
        filter._id = { $in: validObjectIds };
      } else if (searchTerms.length > 0) {
        // Only search terms
        filter.breed = { $regex: searchTerms.join('|'), $options: 'i' };
      }
    }

    // Get total count for pagination
    const petRecordsCount = await petModel.find(filter).countDocuments();

    // Build query with pagination
    let query = petModel.find(filter)
      .sort({ _id: -1 });

    // Apply pagination
    if (request.skip) {
      query = query.skip(parseInt(request.skip));
    }

    if (request.limit) {
      query = query.limit(parseInt(request.limit));
    }

    const petRecs = await query.lean();

    // Format dates for response
    petRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
    });

    response.success_message(petRecs, res, petRecordsCount);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Stream file from GridFS by gridFsId
exports.getMediaFile = async (req, res) => {
  try {
    const { gridFsId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(gridFsId)) {
      return response.error_message('Invalid GridFS ID format', res);
    }

    // Setup GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });

    // Check if file exists
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(gridFsId) }).toArray();
    if (files.length === 0) {
      return response.error_message('File not found', res);
    }

    const file = files[0];

    // Set response headers
    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Content-Length': file.length,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });

    // Stream the file
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(gridFsId));
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      if (!res.headersSent) {
        response.error_message('Error streaming file: ' + error.message, res);
      }
    });

  } catch (error) {
    response.error_message('Internal server error: ' + error.message, res);
  }
};

// Backward compatibility exports
exports.create = exports.createPet;
exports.list = exports.getAllPets;
exports.view = exports.getPetById;
exports.update = exports.updatePet;
exports.delete = exports.deletePet;

// Fetch pets by userId
exports.getPetsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return response.error_message('Invalid User ID format', res);
    }

    const filter = {
      isDeleted: false,
      userId: mongoose.Types.ObjectId.createFromHexString(userId),
    };

    const pets = await petModel.find(filter)
      .sort({ _id: -1 })
      .lean();

    // Setup GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'pet_media' });

    // Helper to fetch base64 content
    const fetchFileContent = async (file) => {
      if (!file || !file.gridFsId) return file;
      try {
        const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(file.gridFsId));
        const chunks = [];
        return new Promise((resolve, reject) => {
          downloadStream.on('data', (chunk) => chunks.push(chunk));
          downloadStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              ...file,
              fileContent: buffer.toString('base64'),
            });
          });
          downloadStream.on('error', reject);
        });
      } catch (e) {
        return file;
      }
    };

    // Enrich media with base64 content
    for (let i = 0; i < pets.length; i++) {
      const p = pets[i];
      if (p.media && Array.isArray(p.media.images)) {
        p.media.images = await Promise.all(p.media.images.map(fetchFileContent));
      }
      if (p.media && Array.isArray(p.media.videos)) {
        p.media.videos = await Promise.all(p.media.videos.map(fetchFileContent));
      }
      if (p.vaccination && Array.isArray(p.vaccination.files)) {
        p.vaccination.files = await Promise.all(p.vaccination.files.map(fetchFileContent));
      }
      p.createdAt = new Date(p.createdAt).toISOString();
      p.updatedAt = new Date(p.updatedAt).toISOString();
    }

    return response.success_message(pets, res);
  } catch (error) {
    return response.error_message(error.message, res);
  }
};