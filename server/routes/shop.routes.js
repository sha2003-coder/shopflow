const express = require('express');
const { createShop, getMyShop, getShopById } = require('../controllers/shop.controller');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All shop routes require Firebase authentication
router.use(authMiddleware);

// POST /api/shops - Create a new shop for the authenticated user
router.post('/', createShop);

// GET /api/shops/me - Retrieve the current authenticated user's shop
router.get('/me', getMyShop);

// GET /api/shops/:id - Retrieve a shop by ID (protected to verify ownership)
router.get('/:id', getShopById);

module.exports = router;
