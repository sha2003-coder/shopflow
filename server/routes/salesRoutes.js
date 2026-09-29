const express = require('express');
const {
  createSale,
  getSales,
  getSaleById,
} = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All sales routes require active Firebase authentication
router.use(authMiddleware);

// POST /api/sales - Checkout and create a new sale with atomic stock deduction
router.post('/', createSale);

// GET /api/sales - Retrieve sales history for authenticated shop (newest first)
router.get('/', getSales);

// GET /api/sales/:id - Retrieve single sale details (enforcing shop isolation)
router.get('/:id', getSaleById);

module.exports = router;
