const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const user = new Schema(
  {
    firstname: { type: Schema.Types.String, required: true, trim: true },
    lastname: { type: Schema.Types.String, required: true, trim: true },
    email: { type: Schema.Types.String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: Schema.Types.String, required: true },
    mobilenumber: { type: Schema.Types.String, required: false, trim: true },
    dob: { type: Schema.Types.Date, required: false },
    address: { type: Schema.Types.String, required: false, trim: true },
    city: { type: Schema.Types.String, required: false, trim: true },
    state: { type: Schema.Types.String, required: false, trim: true },
    zip: { type: Schema.Types.String, required: false, trim: true },
    profileImage: {
      fileName: { type: Schema.Types.String, required: false },
      fileType: { type: Schema.Types.String, required: false },
      fileSizeKB: { type: Schema.Types.Number, required: false },
      gridFsId: { type: Schema.Types.ObjectId, required: false },
      uploadedAt: { type: Schema.Types.Date, required: false, default: Date.now }
    }
  },
  { timestamps: true }
);

user.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("user", user);


