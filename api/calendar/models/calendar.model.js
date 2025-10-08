const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let calendar = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "user",
    },
    type: {
      type: Schema.Types.String,
      required: true,
      enum: ["availability", "request"],
    },
    start_date: {
      type: Schema.Types.Date,
      required: true,
    },
    end_date: {
      type: Schema.Types.Date,
      required: true,
    },
    status: {
      type: Schema.Types.String,
      required: true,
      enum: ["available", "requested", "booked", "cancelled", "in_review"],
      default: "requested",
    },
    pets: [
      {
        type: Schema.Types.ObjectId,
        ref: "pet",
      },
    ],
    reason: {
      type: Schema.Types.String,
      required: false,
      maxlength: 500,
    },
    neighbor_distance_range: {
      type: Schema.Types.Number,
      required: false,
      min: 1,
      max: 50,
    },
    isDeleted: {
      type: Schema.Types.Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for user information
calendar.virtual("userInfo", {
  ref: "user",
  localField: "user_id",
  foreignField: "_id",
  justOne: true,
});

// Virtual for pet information
calendar.virtual("petInfo", {
  ref: "pet",
  localField: "pets",
  foreignField: "_id",
});

calendar.set("toObject", { virtuals: true });
calendar.set("toJSON", { virtuals: true });

module.exports = mongoose.model("calendar", calendar);
