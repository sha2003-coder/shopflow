const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const shopRoutes = require('./shop.routes');
const productRoutes = require('./product.routes');
const salesRoutes = require('./salesRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

// Register sub-routers
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/products', productRoutes);
router.use('/sales', salesRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
