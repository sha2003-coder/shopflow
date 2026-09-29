/**
 * Barcode Service
 * Thin adapter referencing server/utils/barcodeGenerator.js
 */

const barcodeGenerator = require('../utils/barcodeGenerator');

module.exports = {
  ...barcodeGenerator,
  generateBarcode: barcodeGenerator.generateNextBarcode,
};
