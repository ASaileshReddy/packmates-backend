const calendarModel = require('../models/calendar.model');
const response = require('../../../response');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

// Pet fields to include when populating calendar entries
const petPopulateFields = 'petType breed gender age location ownerId';

// Helpers to embed profile image base64 for user
const enrichUserWithProfileImage = async (user, mongoDb) => {
  if (!user) return user;
  const safe = { ...user };
  delete safe.passwordHash;
  if (safe.profileImage && safe.profileImage.gridFsId && mongoDb) {
    try {
      const userBucket = new GridFSBucket(mongoDb, { bucketName: 'user_media' });
      const gridId = new mongoose.Types.ObjectId(safe.profileImage.gridFsId);
      const downloadStream = userBucket.openDownloadStream(gridId);
      const chunks = [];
      await new Promise((resolve, reject) => {
        downloadStream.on('data', (c) => chunks.push(c));
        downloadStream.on('end', resolve);
        downloadStream.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);
      safe.profileImage.fileContent = buffer.toString('base64');
    } catch (_) {}
  }
  return safe;
};

// Helper to enrich pet media with base64 (images/videos/vaccination)
const enrichPetMediaBase64 = async (pet, mongoDb) => {
  if (!pet || !mongoDb) return pet;
  const bucket = new GridFSBucket(mongoDb, { bucketName: 'pet_media' });
  const fetchFileContent = async (file) => {
    if (!file || !file.gridFsId) return file;
    try {
      const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(file.gridFsId));
      const chunks = [];
      return new Promise((resolve, reject) => {
        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ ...file, fileContent: buffer.toString('base64') });
        });
        downloadStream.on('error', reject);
      });
    } catch (e) { return file; }
  };
  if (pet.media && Array.isArray(pet.media.images)) {
    pet.media.images = await Promise.all(pet.media.images.map(fetchFileContent));
  }
  if (pet.media && Array.isArray(pet.media.videos)) {
    pet.media.videos = await Promise.all(pet.media.videos.map(fetchFileContent));
  }
  if (pet.vaccination && Array.isArray(pet.vaccination.files)) {
    pet.vaccination.files = await Promise.all(pet.vaccination.files.map(fetchFileContent));
  }
  return pet;
};

// Helper function to format dates consistently
const formatCalendarDates = (calendarEntry) => {
  if (!calendarEntry) return calendarEntry;
  
  const formatted = calendarEntry.toObject ? calendarEntry.toObject() : { ...calendarEntry };
  
  // Format dates to preserve the original date part
  if (formatted.start_date) {
    const startDate = new Date(formatted.start_date);
    formatted.start_date = startDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  }
  if (formatted.end_date) {
    const endDate = new Date(formatted.end_date);
    formatted.end_date = endDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  }
  
  return formatted;
};

exports.createCalendarEntry = async (req, res) => {
  try {
    const request = req.body;

    // Validate that end_date is after start_date
    if (new Date(request.end_date) <= new Date(request.start_date)) {
      const data = { message: 'End date must be after start date.' };
      return response.validation_error_message(data, res);
    }

    // Validate type-specific fields
    if (request.type === 'request') {
      if (!request.pets || request.pets.length === 0) {
        const data = { message: 'Pets are required for request type.' };
        return response.validation_error_message(data, res);
      }
      if (!request.reason) {
        const data = { message: 'Reason is required for request type.' };
        return response.validation_error_message(data, res);
      }
    } else if (request.type === 'availability') {
      // neighbor_distance_range is optional for availability type
      // if (!request.neighbor_distance_range) {
      //   const data = { message: 'Neighbor distance range is required for availability type.' };
      //   return response.validation_error_message(data, res);
      // }
    }

    // Check for overlapping entries for the same user
    const overlappingEntry = await calendarModel.findOne({
      user_id: request.user_id,
      start_date: { $lt: new Date(request.end_date) },
      end_date: { $gt: new Date(request.start_date) },
      isDeleted: false,
    });

    if (overlappingEntry) {
      const data = { message: 'You already have an entry for this time period.' };
      return response.validation_error_message(data, res);
    }

    // Parse dates to ensure they're stored as intended (preserve the date part)
    let startDate, endDate;
    
    // If the date string ends with T00:00:00.000, treat it as a date-only value in UTC
    if (request.start_date.endsWith('T00:00:00.000')) {
      const datePart = request.start_date.split('T')[0];
      startDate = new Date(datePart + 'T00:00:00.000Z');
    } else {
      startDate = new Date(request.start_date);
    }
    
    if (request.end_date.endsWith('T00:00:00.000')) {
      const datePart = request.end_date.split('T')[0];
      endDate = new Date(datePart + 'T00:00:00.000Z');
    } else {
      endDate = new Date(request.end_date);
    }

    const calendarRec = await calendarModel.create({
      user_id: request.user_id,
      type: request.type,
      start_date: startDate,
      end_date: endDate,
      status: request.status || (request.type === 'availability' ? 'available' : 'requested'),
      pets: request.pets || [],
      reason: request.reason || '',
      neighbor_distance_range: request.neighbor_distance_range || null,
      isDeleted: false,
    });

    if (calendarRec) {
      const formattedEntry = formatCalendarDates(calendarRec);
      response.success_message(formattedEntry, res);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      response.validation_error_message({ message: 'Validation error: ' + error.message }, res);
    } else if (error.name === 'MongoError' && error.code === 11000) {
      response.validation_error_message({ message: 'Calendar entry already exists' }, res);
    } else {
      response.error_message(error.message, res);
    }
  }
};

exports.getAllCalendarEntries = async (req, res) => {
  try {
    const request = req.query;
    let filter = {
      isDeleted: false,
    };

    // Filter by user
    if (request.user_id) {
      filter.user_id = mongoose.Types.ObjectId.createFromHexString(request.user_id);
    }

    // Filter by type
    if (request.type) {
      filter.type = request.type;
    }

    // Filter by status
    if (request.status) {
      filter.status = request.status;
    }

    // Filter by date range
    if (request.start_date) {
      filter.start_date = { $gte: new Date(request.start_date) };
    }
    if (request.end_date) {
      filter.end_date = { $lte: new Date(request.end_date) };
    }

    // Filter by neighbor distance range (for availability type)
    if (request.neighbor_distance_range) {
      filter.neighbor_distance_range = { $lte: parseInt(request.neighbor_distance_range) };
    }

    const calendarRecordsCount = await calendarModel.find(filter).countDocuments();
    const calendarRecs = await calendarModel.find(filter)
      .populate('user_id')
      .populate('pets')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Format dates for response
    const mongoDb = mongoose.connection.db;
    const formattedEntries = [];
    for (const entry of calendarRecs) {
      const formatted = formatCalendarDates(entry);
      formatted.createdAt = new Date(entry.createdAt).toISOString();
      formatted.updatedAt = new Date(entry.updatedAt).toISOString();
      // Enrich user and pet data
      if (formatted.user_id) formatted.user_id = await enrichUserWithProfileImage(formatted.user_id, mongoDb);
      if (Array.isArray(formatted.pets)) {
        const enrichedPets = [];
        for (const p of formatted.pets) {
          enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
        }
        formatted.pets = enrichedPets;
      }
      formattedEntries.push(formatted);
    }

    res.json({
      success: true,
      data: formattedEntries,
      count: calendarRecordsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getCalendarEntryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Calendar Entry ID format', res);
    }

    const calendarRec = await calendarModel.findOne({ _id: id, isDeleted: false })
      .populate('user_id')
      .populate('pets');
    
    if (!calendarRec) {
      return response.error_message('Calendar entry not found', res);
    }

    // Format dates for response
    const mongoDb = mongoose.connection.db;
    const formattedEntry = formatCalendarDates(calendarRec);
    formattedEntry.createdAt = new Date(calendarRec.createdAt).toISOString();
    formattedEntry.updatedAt = new Date(calendarRec.updatedAt).toISOString();
    if (formattedEntry.user_id) formattedEntry.user_id = await enrichUserWithProfileImage(formattedEntry.user_id, mongoDb);
    if (Array.isArray(formattedEntry.pets)) {
      const enrichedPets = [];
      for (const p of formattedEntry.pets) {
        enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
      }
      formattedEntry.pets = enrichedPets;
    }

    response.success_message(formattedEntry, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.updateCalendarEntry = async (req, res) => {
  try {
    const request = req.body;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Calendar Entry ID format', res);
    }

    // Validate that end_date is after start_date
    if (request.end_date && request.start_date && new Date(request.end_date) <= new Date(request.start_date)) {
      const data = { message: 'End date must be after start date.' };
      return response.validation_error_message(data, res);
    }

    const calendarRec = await calendarModel.findById(id);
    if (!calendarRec) {
      return response.error_message('Calendar entry not found', res);
    }

    // Check for overlapping entries (excluding current record)
    if (request.start_date || request.end_date) {
      let startDate, endDate;
      
      if (request.start_date) {
        if (request.start_date.endsWith('T00:00:00.000')) {
          const datePart = request.start_date.split('T')[0];
          startDate = new Date(datePart + 'T00:00:00.000Z');
        } else {
          startDate = new Date(request.start_date);
        }
      } else {
        startDate = calendarRec.start_date;
      }
      
      if (request.end_date) {
        if (request.end_date.endsWith('T00:00:00.000')) {
          const datePart = request.end_date.split('T')[0];
          endDate = new Date(datePart + 'T00:00:00.000Z');
        } else {
          endDate = new Date(request.end_date);
        }
      } else {
        endDate = calendarRec.end_date;
      }

      const overlappingEntry = await calendarModel.findOne({
        user_id: calendarRec.user_id,
        start_date: { $lt: endDate },
        end_date: { $gt: startDate },
        _id: { $ne: id },
        isDeleted: false,
      });

      if (overlappingEntry) {
        const data = { message: 'You already have an entry for this time period.' };
        return response.validation_error_message(data, res);
      }
    }

    const updateData = {};
    
    if (request.type !== undefined) updateData.type = request.type;
    if (request.start_date !== undefined) {
      if (request.start_date.endsWith('T00:00:00.000')) {
        const datePart = request.start_date.split('T')[0];
        updateData.start_date = new Date(datePart + 'T00:00:00.000Z');
      } else {
        updateData.start_date = new Date(request.start_date);
      }
    }
    if (request.end_date !== undefined) {
      if (request.end_date.endsWith('T00:00:00.000')) {
        const datePart = request.end_date.split('T')[0];
        updateData.end_date = new Date(datePart + 'T00:00:00.000Z');
      } else {
        updateData.end_date = new Date(request.end_date);
      }
    }
    if (request.status !== undefined) updateData.status = request.status;
    if (request.pets !== undefined) updateData.pets = request.pets;
    if (request.reason !== undefined) updateData.reason = request.reason;
    if (request.neighbor_distance_range !== undefined) updateData.neighbor_distance_range = request.neighbor_distance_range;

    const updated_calendar = await calendarModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType');

    if (updated_calendar) {
      const data = {
        message: 'Calendar entry updated successfully',
        calendar: updated_calendar,
      };

      return response.success_message(data, res);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.error_message('Validation error: ' + error.message, res);
    } else if (error.name === 'MongoError' && error.code === 11000) {
      return response.error_message('Calendar entry already exists', res);
    } else {
      return response.error_message('Internal server error: ' + error.message, res);
    }
  }
};

exports.deleteCalendarEntry = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Calendar Entry ID format', res);
    }

    const results = await calendarModel.deleteOne({ _id: id });

    if (results) {
      var message = results.deletedCount > 0 ? 'Deleted Successfully' : 'Record Not Found';

      if (calendarModel) {
        let data = { message: message, deletedCount: results.deletedCount };
        response.success_message(data, res);
      }
    }
  } catch (err) {
    let data = { message: err.message };
    response.validation_error_message(data, res);
  }
};

exports.softDeleteCalendarEntry = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Calendar Entry ID format', res);
    }

    const calendar = await calendarModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } }
    );
    
    if (calendar) {
      let data = {
        message: 'Calendar entry has been Deleted Successfully',
        deletedCount: 1,
      };
      
      response.success_message(data, res);
    }
  } catch (error) {
    data = { message: error.message };
    response.validation_error_message(data, res);
  }
};

// Filter by type
exports.filterByType = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.type) {
      filter.type = req.query.type;
    }
    const calendarRec = await calendarModel.find(filter)
      .populate('user_id', 'firstname lastname email')
      .populate('pets', petPopulateFields);
    response.success_message(calendarRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Filter by status
exports.filterByStatus = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const calendarRec = await calendarModel.find(filter)
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType');
    response.success_message(calendarRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Filter by user
exports.filterByUser = async (req, res) => {
  try {
    let filter = { isDeleted: false };
    if (req.query.user_id) {
      filter.user_id = req.query.user_id;
    }
    const calendarRec = await calendarModel.find(filter)
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType');
    response.success_message(calendarRec, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Get calendar statistics
exports.getCalendarStats = async (req, res) => {
  try {
    const totalEntries = await calendarModel.countDocuments({ isDeleted: false });
    const entriesByType = await calendarModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const entriesByStatus = await calendarModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const availabilityEntries = await calendarModel.countDocuments({ 
      isDeleted: false, 
      type: 'availability' 
    });
    const requestEntries = await calendarModel.countDocuments({ 
      isDeleted: false, 
      type: 'request' 
    });

    const stats = {
      totalEntries,
      entriesByType,
      entriesByStatus,
      availabilityEntries,
      requestEntries,
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

    // Filter by type
    if (request.type) {
      filter.type = request.type;
    }

    // Filter by status
    if (request.status) {
      filter.status = request.status;
    }

    // Filter by user
    if (request.user_id) {
      filter.user_id = request.user_id;
    }

    // Filter by date range
    if (request.start_date) {
      filter.start_date = { $gte: new Date(request.start_date) };
    }
    if (request.end_date) {
      filter.end_date = { $lte: new Date(request.end_date) };
    }

    // Filter by neighbor distance range (for availability type)
    if (request.neighbor_distance_range) {
      filter.neighbor_distance_range = { $lte: parseInt(request.neighbor_distance_range) };
    }

    // Get total count for pagination
    const calendarRecordsCount = await calendarModel.find(filter).countDocuments();

    // Build query with pagination
    let query = calendarModel.find(filter)
      .populate('user_id', 'firstname lastname email')
      .populate('pets', petPopulateFields)
      .sort({ start_date: 1 });

    // Apply pagination
    if (request.skip) {
      query = query.skip(parseInt(request.skip));
    }

    if (request.limit) {
      query = query.limit(parseInt(request.limit));
    }

    const calendarRecs = await query.lean();

    const mongoDb = mongoose.connection.db;
    const formattedEntries = [];
    for (const entry of calendarRecs) {
      const formatted = formatCalendarDates(entry);
      formatted.createdAt = new Date(entry.createdAt).toISOString();
      formatted.updatedAt = new Date(entry.updatedAt).toISOString();
      if (formatted.user_id) formatted.user_id = await enrichUserWithProfileImage(formatted.user_id, mongoDb);
      if (Array.isArray(formatted.pets)) {
        const enrichedPets = [];
        for (const p of formatted.pets) {
          enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
        }
        formatted.pets = enrichedPets;
      }
      formattedEntries.push(formatted);
    }

    response.success_message(formattedEntries, res, calendarRecordsCount);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Find matching availability for requests
exports.findMatchingAvailability = async (req, res) => {
  try {
    const { request_id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(request_id)) {
      return response.error_message('Invalid Request ID format', res);
    }

    const requestEntry = await calendarModel.findOne({ 
      _id: request_id, 
      type: 'request',
      isDeleted: false 
    });

    if (!requestEntry) {
      return response.error_message('Request not found', res);
    }

    // Find availability entries that overlap with the request period
    const matchingAvailability = await calendarModel.find({
      type: 'availability',
      status: 'available',
      start_date: { $lte: requestEntry.end_date },
      end_date: { $gte: requestEntry.start_date },
      isDeleted: false,
    })
    .populate('user_id', 'firstname lastname email')
    .sort({ neighbor_distance_range: 1 });

    response.success_message(matchingAvailability, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

// Get calendar entries by user ID
exports.getCalendarEntriesByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const request = req.query;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return response.error_message('Invalid User ID format', res);
    }

    let filter = {
      user_id: mongoose.Types.ObjectId.createFromHexString(user_id),
      isDeleted: false,
    };

    // Optional filters
    if (request.type) {
      filter.type = request.type;
    }
    if (request.status) {
      filter.status = request.status;
    }
    if (request.start_date) {
      filter.start_date = { $gte: new Date(request.start_date) };
    }
    if (request.end_date) {
      filter.end_date = { $lte: new Date(request.end_date) };
    }

    const calendarRecordsCount = await calendarModel.find(filter).countDocuments();
    const calendarRecs = await calendarModel.find(filter)
      .populate('user_id')
      .populate('pets')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    const mongoDb = mongoose.connection.db;
    const formattedEntries = [];
    for (const entry of calendarRecs) {
      const formatted = formatCalendarDates(entry);
      formatted.createdAt = new Date(entry.createdAt).toISOString();
      formatted.updatedAt = new Date(entry.updatedAt).toISOString();
      if (formatted.user_id) formatted.user_id = await enrichUserWithProfileImage(formatted.user_id, mongoDb);
      if (Array.isArray(formatted.pets)) {
        const enrichedPets = [];
        for (const p of formatted.pets) {
          enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
        }
        formatted.pets = enrichedPets;
      }
      formattedEntries.push(formatted);
    }

    res.json({
      success: true,
      data: formattedEntries,
      count: calendarRecordsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all request type entries
exports.getAllRequests = async (req, res) => {
  try {
    const request = req.query;
    let filter = {
      type: 'request',
      isDeleted: false,
    };

    // Optional filters
    if (request.status) {
      filter.status = request.status;
    }
    if (request.user_id) {
      filter.user_id = mongoose.Types.ObjectId.createFromHexString(request.user_id);
    }
    if (request.start_date) {
      filter.start_date = { $gte: new Date(request.start_date) };
    }
    if (request.end_date) {
      filter.end_date = { $lte: new Date(request.end_date) };
    }

    const calendarRecordsCount = await calendarModel.find(filter).countDocuments();
    const calendarRecs = await calendarModel.find(filter)
      .populate('user_id')
      .populate('pets')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    const mongoDb = mongoose.connection.db;
    const formattedEntries = [];
    for (const entry of calendarRecs) {
      const formatted = formatCalendarDates(entry);
      formatted.createdAt = new Date(entry.createdAt).toISOString();
      formatted.updatedAt = new Date(entry.updatedAt).toISOString();
      if (formatted.user_id) formatted.user_id = await enrichUserWithProfileImage(formatted.user_id, mongoDb);
      if (Array.isArray(formatted.pets)) {
        const enrichedPets = [];
        for (const p of formatted.pets) {
          enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
        }
        formatted.pets = enrichedPets;
      }
      formattedEntries.push(formatted);
    }

    res.json({
      success: true,
      data: formattedEntries,
      count: calendarRecordsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all availability type entries
exports.getAllAvailability = async (req, res) => {
  try {
    const request = req.query;
    let filter = {
      type: 'availability',
      isDeleted: false,
    };

    // Optional filters
    if (request.status) {
      filter.status = request.status;
    }
    if (request.user_id) {
      filter.user_id = mongoose.Types.ObjectId.createFromHexString(request.user_id);
    }
    if (request.start_date) {
      filter.start_date = { $gte: new Date(request.start_date) };
    }
    if (request.end_date) {
      filter.end_date = { $lte: new Date(request.end_date) };
    }
    if (request.neighbor_distance_range) {
      filter.neighbor_distance_range = { $lte: parseInt(request.neighbor_distance_range) };
    }

    const calendarRecordsCount = await calendarModel.find(filter).countDocuments();
    const calendarRecs = await calendarModel.find(filter)
      .populate('user_id')
      .populate('pets')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    const mongoDb = mongoose.connection.db;
    const formattedEntries = [];
    for (const entry of calendarRecs) {
      const formatted = formatCalendarDates(entry);
      formatted.createdAt = new Date(entry.createdAt).toISOString();
      formatted.updatedAt = new Date(entry.updatedAt).toISOString();
      if (formatted.user_id) formatted.user_id = await enrichUserWithProfileImage(formatted.user_id, mongoDb);
      if (Array.isArray(formatted.pets)) {
        const enrichedPets = [];
        for (const p of formatted.pets) {
          enrichedPets.push(await enrichPetMediaBase64(p, mongoDb));
        }
        formatted.pets = enrichedPets;
      }
      formattedEntries.push(formatted);
    }

    res.json({
      success: true,
      data: formattedEntries,
      count: calendarRecordsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Backward compatibility exports
exports.create = exports.createCalendarEntry;
exports.list = exports.getAllCalendarEntries;
exports.view = exports.getCalendarEntryById;
exports.update = exports.updateCalendarEntry;
exports.delete = exports.deleteCalendarEntry;
