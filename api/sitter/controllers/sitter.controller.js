const sitterModel = require('../models/sitter.model');
const userModel = require('../../user/models/user.model');
const response = require('../../../response');
const mongoose = require('mongoose');

exports.createSitter = async (req, res) => {
  try {
    const { userId, bio, experience, hourlyRate, services, availability, location } = req.body;

    // Check if user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return response.error_message('User not found', res);
    }

    // Check if sitter profile already exists
    const existingSitter = await sitterModel.findOne({ userId });
    if (existingSitter) {
      return response.validation_error_message({ message: 'Sitter profile already exists for this user' }, res);
    }

    const sitter = await sitterModel.create({
      userId,
      bio,
      experience,
      hourlyRate,
      services: services || [],
      availability: availability || [],
      location: location || {}
    });

    // Populate user details
    const populatedSitter = await sitterModel.findById(sitter._id).populate('userId', 'firstname lastname email');
    
    response.success_message(populatedSitter, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.getSitters = async (req, res) => {
  try {
    const { city, state, services, minRate, maxRate, isVerified, isActive } = req.query;
    
    let filter = {};
    
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (state) filter['location.state'] = new RegExp(state, 'i');
    if (services) filter.services = { $in: services.split(',') };
    if (minRate || maxRate) {
      filter.hourlyRate = {};
      if (minRate) filter.hourlyRate.$gte = Number(minRate);
      if (maxRate) filter.hourlyRate.$lte = Number(maxRate);
    }
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const sitters = await sitterModel.find(filter)
      .populate('userId', 'firstname lastname email profileImage')
      .sort({ rating: -1, totalReviews: -1 })
      .lean();

    response.success_message(sitters, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.getSitterById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Sitter ID format', res);
    }

    const sitter = await sitterModel.findById(id)
      .populate('userId', 'firstname lastname email profileImage')
      .lean();
    
    if (!sitter) {
      return response.error_message('Sitter not found', res);
    }

    response.success_message(sitter, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.updateSitter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Sitter ID format', res);
    }

    const sitter = await sitterModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'firstname lastname email profileImage')
      .lean();

    if (!sitter) {
      return response.error_message('Sitter not found', res);
    }

    response.success_message(sitter, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.deleteSitter = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error_message('Invalid Sitter ID format', res);
    }

    const result = await sitterModel.findByIdAndDelete(id);
    
    if (!result) {
      return response.error_message('Sitter not found', res);
    }

    response.success_message({ message: 'Sitter profile deleted successfully' }, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.getAvailableSitters = async (req, res) => {
  try {
    const { date, time, city, state } = req.query;
    
    if (!date || !time) {
      return response.validation_error_message({ message: 'Date and time are required' }, res);
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const requestedTime = time;

    let filter = {
      isActive: true,
      'availability.dayOfWeek': dayOfWeek,
      'availability.isAvailable': true,
      'availability.startTime': { $lte: requestedTime },
      'availability.endTime': { $gte: requestedTime }
    };

    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (state) filter['location.state'] = new RegExp(state, 'i');

    const sitters = await sitterModel.find(filter)
      .populate('userId', 'firstname lastname email profileImage')
      .sort({ rating: -1, totalReviews: -1 })
      .lean();

    response.success_message(sitters, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};
