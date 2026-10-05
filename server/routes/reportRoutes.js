const express = require('express');
const {
  getSalesReport,
  getInventoryReport,
} = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All report endpoints strictly require active Firebase authentication
router.use(authMiddleware);

// GET /api/reports/sales - Generates sales reports with date range filtering
router.get('/sales', getSalesReport);

// GET /api/reports/inventory - Generates low-stock and out-of-stock product report
router.get('/inventory', getInventoryReport);

module.exports = router;
