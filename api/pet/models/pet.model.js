const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let pet = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    petType: {
      type: Schema.Types.String,
      required: true,
    },
    breed: {
      type: Schema.Types.String,
      required: true,
      trim: true,
    },
    gender: {
      type: Schema.Types.String,
      required: true,
      enum: ["Male", "Female"],
    },
    age: {
      label: {
        type: Schema.Types.String,
        required: true,
        enum: ["Puppy", "Kitten", "Young", "Adult", "Senior"],
      },
      months: {
        type: Schema.Types.Number,
        required: true,
        min: 0,
        max: 300,
      },
    },
    weightKg: {
      type: Schema.Types.Number,
      required: true,
      min: 0.1,
      max: 200,
    },
    nutrition: {
      description: {
        type: Schema.Types.String,
        required: false,
        maxlength: 1000,
      },
    },
    media: {
      images: [
        {
          fileName: {
            type: Schema.Types.String,
            required: true,
          },
          // Optional raw binary content when provided as base64 in JSON
          fileContent: {
            type: Buffer,
            required: false,
          },
          gridFsId: {
            type: Schema.Types.ObjectId,
            required: false,
          },
          fileSizeKB: {
            type: Schema.Types.Number,
            required: true,
            min: 0,
          },
          status: {
            type: Schema.Types.String,
            required: true,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending",
          },
          fileType: {
            type: Schema.Types.String,
            required: true,
            enum: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          },
          uploadedAt: {
            type: Schema.Types.Date,
            required: true,
            default: Date.now,
          },
        },
      ],
      videos: [
        {
          fileName: {
            type: Schema.Types.String,
            required: true,
          },
          // Optional raw binary content when provided as base64 in JSON
          fileContent: {
            type: Buffer,
            required: false,
          },
          gridFsId: {
            type: Schema.Types.ObjectId,
            required: false,
          },
          fileSizeMB: {
            type: Schema.Types.Number,
            required: true,
            min: 0,
          },
          status: {
            type: Schema.Types.String,
            required: true,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending",
          },
          fileType: {
            type: Schema.Types.String,
            required: true,
            enum: ["video/mp4", "video/avi", "video/mov", "video/wmv"],
          },
          uploadedAt: {
            type: Schema.Types.Date,
            required: true,
            default: Date.now,
          },
          url: {
            type: Schema.Types.String,
            required: false,
          },
        },
      ],
      videoUrl: {
        type: Schema.Types.String,
        required: false,
        default: "",
      },
    },
    vaccination: {
      status: {
        type: Schema.Types.Boolean,
        required: true,
        default: false,
      },
      files: [
        {
          fileName: {
            type: Schema.Types.String,
            required: true,
          },
          // Optional raw binary content when provided as base64 in JSON
          fileContent: {
            type: Buffer,
            required: false,
          },
          gridFsId: {
            type: Schema.Types.ObjectId,
            required: false,
          },
          fileSizeKB: {
            type: Schema.Types.Number,
            required: true,
            min: 0,
          },
          fileType: {
            type: Schema.Types.String,
            required: true,
            enum: ["application/pdf", "image/jpeg", "image/png"],
          },
          status: {
            type: Schema.Types.String,
            required: true,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending",
          },
          uploadedAt: {
            type: Schema.Types.Date,
            required: true,
            default: Date.now,
          },
        },
      ],
    },
    ongoingTreatment: {
      type: Schema.Types.Boolean,
      required: true,
      default: false,
    },
    behaviours: [
      {
        type: Schema.Types.String,
        required: false,
        trim: true,
        maxlength: 50,
      },
    ],
    isDeleted: {
      type: Schema.Types.Boolean,
      required: true,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pagination removed for mobile app compatibility

pet.virtual("ownerInfo", {
  ref: "User",
  localField: "ownerId",
  foreignField: "_id",
  justOne: true,
});

pet.set("toObject", { virtuals: true });
pet.set("toJSON", { virtuals: true });

module.exports = mongoose.model("pet", pet);
