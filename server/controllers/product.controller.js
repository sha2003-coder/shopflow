const productService = require('../services/productService');

/**
 * POST /api/products
 * Creates a new product for the authenticated user's shop.
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body, req.user, req.idToken);
    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    console.error('[Product Controller] createProduct error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to create product' },
    });
  }
};

/**
 * GET /api/products
 * Returns all products belonging to the authenticated user's shop with search and filters.
 */
const getProducts = async (req, res, next) => {
  try {
    const products = await productService.getProducts(req.user, req.idToken, req.query);
    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('[Product Controller] getProducts error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve products' },
    });
  }
};

/**
 * GET /api/products/:id
 * Retrieves a single product by ID, verifying shop ownership.
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id, req.user, req.idToken);
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('[Product Controller] getProductById error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve product' },
    });
  }
};

/**
 * GET /api/products/barcode/:barcode
 * Retrieves a single product by barcode within the user's shop.
 */
const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    const product = await productService.getProductByBarcode(barcode, req.user, req.idToken);
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('[Product Controller] getProductByBarcode error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve product by barcode' },
    });
  }
};

/**
 * PUT /api/products/:id
 * Updates an existing product. Immutable fields (id, shopId, createdAt, barcode) are preserved.
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body, req.user, req.idToken);
    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    console.error('[Product Controller] updateProduct error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to update product' },
    });
  }
};

/**
 * DELETE /api/products/:id
 * Permanently deletes a product document after verifying shop ownership.
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id, req.user, req.idToken);
    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      id,
    });
  } catch (error) {
    console.error('[Product Controller] deleteProduct error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to delete product' },
    });
  }
};

/**
 * GET /api/products/:id/barcode-image
 * Generates and streams on-the-fly Code 128 PNG barcode image with human-readable text.
 * Strictly verifies shop ownership.
 */
const getProductBarcodeImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageBuffer, barcode, product } = await productService.getProductBarcodeImage(id, req.user, req.idToken);

    // Sanitize SKU for filename: replace spaces and special characters with hyphens
    const rawSku = String(product?.sku || 'SKU').trim();
    const sanitizedSku = rawSku
      .replace(/[/\\?%*:|"<> ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'SKU';
    const filename = `barcode-${sanitizedSku}-${barcode}.png`;

    const isDownload = req.query.download === 'true' || req.query.download === '1';

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Barcode-Value': barcode,
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
    });

    return res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('[Product Controller] getProductBarcodeImage error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to generate barcode image' },
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBarcodeImage,
  updateProduct,
  deleteProduct,
};
