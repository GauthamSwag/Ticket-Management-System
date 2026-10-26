const SLA = require('../models/SLA');

// @desc    Get all SLA configurations
// @route   GET /api/sla
// @access  Private (Authenticated users can view; Admin can edit)
const getSLAs = async (req, res, next) => {
  try {
    await SLA.seedDefaultsIfEmpty();
    const slas = await SLA.find().sort({ responseTimeHours: 1 });

    res.status(200).json({
      success: true,
      count: slas.length,
      slas,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update SLA target for a priority level
// @route   PUT /api/sla/:priority
// @access  Private (Admin only)
const updateSLA = async (req, res, next) => {
  try {
    const { priority } = req.params;
    const { responseTimeHours, resolutionTimeHours, isActive } = req.body;

    if (!['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority '${priority}'. Allowed: Low, Medium, High, Critical`,
      });
    }

    if (responseTimeHours !== undefined && (isNaN(responseTimeHours) || responseTimeHours <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'responseTimeHours must be a positive number',
      });
    }

    if (resolutionTimeHours !== undefined && (isNaN(resolutionTimeHours) || resolutionTimeHours <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'resolutionTimeHours must be a positive number',
      });
    }

    await SLA.seedDefaultsIfEmpty();

    let sla = await SLA.findOne({ priority });
    if (!sla) {
      sla = new SLA({ priority });
    }

    if (responseTimeHours !== undefined) sla.responseTimeHours = Number(responseTimeHours);
    if (resolutionTimeHours !== undefined) sla.resolutionTimeHours = Number(resolutionTimeHours);
    if (isActive !== undefined) sla.isActive = Boolean(isActive);

    await sla.save();

    res.status(200).json({
      success: true,
      message: `SLA targets for priority '${priority}' successfully updated`,
      sla,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSLAs,
  updateSLA,
};
