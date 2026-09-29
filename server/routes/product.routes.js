const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBarcodeImage,
  updateProduct,
  deleteProduct,
} = require('../controllers/product.controller');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All product routes require active Firebase authentication
router.use(authMiddleware);

// POST /api/products - Create a new product in user's shop
router.post('/', createProduct);

// GET /api/products - Retrieve products in user's shop with search & filtering
router.get('/', getProducts);

// GET /api/products/barcode/:barcode - Retrieve single product by barcode within shop
router.get('/barcode/:barcode', getProductByBarcode);

// GET /api/products/:id/barcode-image - Stream Code 128 PNG barcode image
router.get('/:id/barcode-image', getProductBarcodeImage);

// GET /api/products/:id - Retrieve single product by ID (owner check)
router.get('/:id', getProductById);

// PUT /api/products/:id - Update product fields
router.put('/:id', updateProduct);

// DELETE /api/products/:id - Delete product
router.delete('/:id', deleteProduct);

module.exports = router;
