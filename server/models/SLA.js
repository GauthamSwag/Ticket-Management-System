const mongoose = require('mongoose');

const DEFAULT_SLAS = [
  { priority: 'Critical', responseTimeHours: 1, resolutionTimeHours: 8, isActive: true },
  { priority: 'High', responseTimeHours: 4, resolutionTimeHours: 24, isActive: true },
  { priority: 'Medium', responseTimeHours: 12, resolutionTimeHours: 48, isActive: true },
  { priority: 'Low', responseTimeHours: 24, resolutionTimeHours: 72, isActive: true },
];

const SLASchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      required: [true, 'SLA priority is required'],
      unique: true,
      enum: {
        values: ['Low', 'Medium', 'High', 'Critical'],
        message: '{VALUE} is not a valid priority for SLA',
      },
    },
    responseTimeHours: {
      type: Number,
      required: [true, 'Response time target in hours is required'],
      min: [0.1, 'Response time must be greater than 0'],
    },
    resolutionTimeHours: {
      type: Number,
      required: [true, 'Resolution time target in hours is required'],
      min: [0.1, 'Resolution time must be greater than 0'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

SLASchema.index({ priority: 1, isActive: 1 });

// Helper to seed defaults if collection is empty
SLASchema.statics.seedDefaultsIfEmpty = async function () {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.insertMany(DEFAULT_SLAS);
  }
};

// Retrieve active SLA config for priority, falling back to default values
SLASchema.statics.getSLAForPriority = async function (priority) {
  let sla = await this.findOne({ priority, isActive: true });
  if (!sla) {
    await this.seedDefaultsIfEmpty();
    sla = await this.findOne({ priority, isActive: true });
  }
  if (!sla) {
    const fallback = DEFAULT_SLAS.find((d) => d.priority === priority) || DEFAULT_SLAS[2];
    return fallback;
  }
  return sla;
};

module.exports = mongoose.model('SLA', SLASchema);
module.exports.DEFAULT_SLAS = DEFAULT_SLAS;
