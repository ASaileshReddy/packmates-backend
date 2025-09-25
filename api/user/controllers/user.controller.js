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
    const { firstname, lastname, email, password, mobilenumber, dob, address, city, state, zip } = req.body;

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
      dob: dob ? new Date(dob) : undefined,
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

    // If profile image exists, embed base64 content for immediate display
    try {
      if (safeUser.profileImage && safeUser.profileImage.gridFsId) {
        const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'user_media' });
        const gridId = new mongoose.Types.ObjectId(safeUser.profileImage.gridFsId);
        const downloadStream = bucket.openDownloadStream(gridId);
        const chunks = [];
        await new Promise((resolve, reject) => {
          downloadStream.on('data', (c) => chunks.push(c));
          downloadStream.on('end', resolve);
          downloadStream.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        safeUser.profileImage.fileContent = buffer.toString('base64');
      }
    } catch (e) {
      // ignore errors; return metadata only
    }

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
    const { firstname, lastname, email, mobilenumber, dob, address, city, state, zip } = req.body;

    const update = {};
    if (firstname !== undefined) update.firstname = firstname;
    if (lastname !== undefined) update.lastname = lastname;
    if (email !== undefined) update.email = email.toLowerCase();
    if (mobilenumber !== undefined) update.mobilenumber = mobilenumber;
    if (dob !== undefined) update.dob = dob ? new Date(dob) : undefined;
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

exports.updateProfileImage = async (req, res) => {
  try {
    const { id } = req.params;
    // Accept either multipart (req.file) or JSON base64 (req.body.profileImage or flat fields)
    let fileName, fileType, fileBuffer, fileSize;

    if (req.file && req.file.buffer) {
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
      fileBuffer = req.file.buffer;
      fileSize = req.file.size;
    } else {
      const bodyImg = req.body.profileImage || req.body;
      const b64 = bodyImg?.fileContent;
      if (!b64) {
        return response.validation_error_message({ message: 'profileImage file is required' }, res);
      }
      try {
        fileBuffer = Buffer.from(b64, 'base64');
      } catch (e) {
        return response.validation_error_message({ message: 'Invalid base64 for profile image' }, res);
      }
      fileName = bodyImg.fileName || 'profile';
      fileType = bodyImg.fileType || 'application/octet-stream';
      fileSize = bodyImg.fileSizeKB ? Math.round(Number(bodyImg.fileSizeKB) * 1024) : fileBuffer.length;
    }

    // Upload to GridFS
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'user_media' });
    const gridFsId = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(fileName || 'profile', { contentType: fileType });
      stream.end(fileBuffer, (err) => {
        if (err) return reject(err);
        resolve(stream.id);
      });
    });

    const profileImage = {
      fileName,
      fileType,
      fileSizeKB: Math.max(1, Math.round((fileSize || fileBuffer.length) / 1024)),
      gridFsId,
      uploadedAt: new Date()
    };

    const updated = await userModel.findByIdAndUpdate(
      id,
      { $set: { profileImage } },
      { new: true }
    ).lean();

    if (!updated) {
      return response.error_message('User not found', res);
    }

    delete updated.passwordHash;

    // Load file content from GridFS and embed as base64 for immediate client display
    try {
      const files = await bucket.find({ _id: new mongoose.Types.ObjectId(gridFsId) }).toArray();
      if (files.length > 0) {
        const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(gridFsId));
        const chunks = [];
        await new Promise((resolve, reject) => {
          downloadStream.on('data', (c) => chunks.push(c));
          downloadStream.on('end', resolve);
          downloadStream.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        if (updated.profileImage) {
          updated.profileImage.fileContent = buffer.toString('base64');
        }
      }
    } catch (e) {
      // ignore file load errors; still return metadata
    }

    // Return profileImage details including base64 content
    response.success_message({ _id: updated._id, profileImage: updated.profileImage }, res);
  } catch (error) {
    response.error_message(error.message, res);
  }
};


