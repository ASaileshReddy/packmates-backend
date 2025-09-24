const userModel = require('../models/user.model');
const response = require('../../../response');
const bcrypt = require('bcryptjs');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

// Helper to upload single file to GridFS
async function uploadSingleToGridFS(file) {
  if (!file || !file.buffer) return { gridFsId: undefined, fileSizeKB: undefined };
  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'user_media' });
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(file.originalname || 'profile', { contentType: file.mimetype });
    stream.end(file.buffer, (err) => {
      if (err) return reject(err);
      resolve({ gridFsId: stream.id, fileSizeKB: Math.max(1, Math.round(file.size / 1024)) });
    });
  });
}

exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, password, mobilenumber, address, city, state, zip } = req.body;

    // Check duplicate email
    const existing = await userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      return response.validation_error_message({ message: 'Email already registered' }, res);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Profile image (single file named 'profileImage')
    let profileImage = undefined;
    if (req.file) {
      const uploaded = await uploadSingleToGridFS(req.file);
      profileImage = {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSizeKB: uploaded.fileSizeKB,
        gridFsId: uploaded.gridFsId,
        uploadedAt: new Date()
      };
    }

    const user = await userModel.create({
      firstname,
      lastname,
      email: email.toLowerCase(),
      passwordHash,
      mobilenumber,
      address,
      city,
      state,
      zip,
      profileImage
    });

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    response.success_message(safeUser, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return response.validation_error_message({ message: 'Invalid credentials' }, res);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return response.validation_error_message({ message: 'Invalid credentials' }, res);
    }

    const safeUser = user.toObject();
    delete safeUser.passwordHash;
    response.success_message(safeUser, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id).lean();
    if (!user) {
      return response.error_message('User not found', res);
    }
    delete user.passwordHash;
    delete user.profileImage;
    response.success_message(user, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, lastname, email, mobilenumber, address, city, state, zip } = req.body;

    const update = {};
    if (firstname !== undefined) update.firstname = firstname;
    if (lastname !== undefined) update.lastname = lastname;
    if (email !== undefined) update.email = email.toLowerCase();
    if (mobilenumber !== undefined) update.mobilenumber = mobilenumber;
    if (address !== undefined) update.address = address;
    if (city !== undefined) update.city = city;
    if (state !== undefined) update.state = state;
    if (zip !== undefined) update.zip = zip;

    const updated = await userModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) {
      return response.error_message('User not found', res);
    }
    delete updated.passwordHash;
    delete updated.profileImage;
    response.success_message(updated, res);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return response.validation_error_message({ message: 'Email already in use' }, res);
    }
    response.error_message(error.message, res);
  }
};


