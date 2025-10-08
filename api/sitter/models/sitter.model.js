const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sitter = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    bio: { type: Schema.Types.String, required: false, maxlength: 1000 },
    experience: { type: Schema.Types.String, required: false, maxlength: 500 },
    hourlyRate: { type: Schema.Types.Number, required: false, min: 0 },
    services: [{ type: Schema.Types.String }],
    availability: [{
      dayOfWeek: { type: Schema.Types.String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      startTime: { type: Schema.Types.String },
      endTime: { type: Schema.Types.String },
      isAvailable: { type: Schema.Types.Boolean, default: true }
    }],
    location: {
      address: { type: Schema.Types.String },
      city: { type: Schema.Types.String },
      state: { type: Schema.Types.String },
      zip: { type: Schema.Types.String },
      coordinates: {
        lat: { type: Schema.Types.Number },
        lng: { type: Schema.Types.Number }
      }
    },
    rating: { type: Schema.Types.Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Schema.Types.Number, default: 0 },
    isActive: { type: Schema.Types.Boolean, default: true },
    isVerified: { type: Schema.Types.Boolean, default: false }
  },
  { timestamps: true }
);

sitter.index({ userId: 1 }, { unique: true });
sitter.index({ 'location.city': 1, 'location.state': 1 });
sitter.index({ isActive: 1, isVerified: 1 });

module.exports = mongoose.model("sitter", sitter);
