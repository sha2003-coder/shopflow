const express = require('express');
const { getMe } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/auth/me - Protected by authMiddleware
router.get('/me', authMiddleware, getMe);

module.exports = router;
