const calendarModel = require('../models/calendar.model');
const response = require('../../../response');
const mongoose = require('mongoose');

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
      if (!request.neighbor_distance_range) {
        const data = { message: 'Neighbor distance range is required for availability type.' };
        return response.validation_error_message(data, res);
      }
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

    const calendarRec = await calendarModel.create({
      user_id: request.user_id,
      type: request.type,
      start_date: new Date(request.start_date),
      end_date: new Date(request.end_date),
      status: request.status || (request.type === 'availability' ? 'available' : 'requested'),
      pets: request.pets || [],
      reason: request.reason || '',
      neighbor_distance_range: request.neighbor_distance_range || null,
      isDeleted: false,
    });

    if (calendarRec) {
      response.success_message(calendarRec, res);
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
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Format dates for response
    calendarRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
      item.start_date = new Date(item.start_date).toISOString();
      item.end_date = new Date(item.end_date).toISOString();
    });

    res.json({
      success: true,
      data: calendarRecs,
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
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType');
    
    if (!calendarRec) {
      return response.error_message('Calendar entry not found', res);
    }

    // Format dates for response
    calendarRec.createdAt = new Date(calendarRec.createdAt).toISOString();
    calendarRec.updatedAt = new Date(calendarRec.updatedAt).toISOString();
    calendarRec.start_date = new Date(calendarRec.start_date).toISOString();
    calendarRec.end_date = new Date(calendarRec.end_date).toISOString();

    response.success_message(calendarRec, res);
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
      const startDate = request.start_date ? new Date(request.start_date) : calendarRec.start_date;
      const endDate = request.end_date ? new Date(request.end_date) : calendarRec.end_date;

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
    if (request.start_date !== undefined) updateData.start_date = new Date(request.start_date);
    if (request.end_date !== undefined) updateData.end_date = new Date(request.end_date);
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
      .populate('pets', 'breed petType');
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
      .populate('pets', 'breed petType')
      .sort({ start_date: 1 });

    // Apply pagination
    if (request.skip) {
      query = query.skip(parseInt(request.skip));
    }

    if (request.limit) {
      query = query.limit(parseInt(request.limit));
    }

    const calendarRecs = await query.lean();

    // Format dates for response
    calendarRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
      item.start_date = new Date(item.start_date).toISOString();
      item.end_date = new Date(item.end_date).toISOString();
    });

    response.success_message(calendarRecs, res, calendarRecordsCount);
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
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Format dates for response
    calendarRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
      item.start_date = new Date(item.start_date).toISOString();
      item.end_date = new Date(item.end_date).toISOString();
    });

    res.json({
      success: true,
      data: calendarRecs,
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
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Format dates for response
    calendarRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
      item.start_date = new Date(item.start_date).toISOString();
      item.end_date = new Date(item.end_date).toISOString();
    });

    res.json({
      success: true,
      data: calendarRecs,
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
      .populate('user_id', 'firstname lastname email')
      .populate('pets', 'breed petType')
      .sort({ start_date: 1 })
      .skip(request.skip)
      .limit(request.limit)
      .lean();

    // Format dates for response
    calendarRecs.forEach((item) => {
      item.createdAt = new Date(item.createdAt).toISOString();
      item.updatedAt = new Date(item.updatedAt).toISOString();
      item.start_date = new Date(item.start_date).toISOString();
      item.end_date = new Date(item.end_date).toISOString();
    });

    res.json({
      success: true,
      data: calendarRecs,
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
