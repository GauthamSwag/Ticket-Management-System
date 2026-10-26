const express = require('express');
const router = express.Router();
const { getSLAs, updateSLA } = require('../controllers/slaController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getSLAs);
router.put('/:priority', updateSLA);

module.exports = router;
