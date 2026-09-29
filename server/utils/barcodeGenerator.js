const bwipjs = require('bwip-js');

/**
 * Reusable Internal ShopFlow Barcode Generator & Renderer
 *
 * Format:
 * Prefix "200000" (6 digits) + sequential zero-padded number (6 digits)
 * Total: 12 numeric digits stored strictly as a STRING.
 * Examples: "200000000001", "200000000002", "200000000003"
 */

const BARCODE_PREFIX = '200000';
const SEQUENCE_LENGTH = 6;
const MAX_COLLISION_RETRIES = 100;

/**
 * Validates whether a barcode adheres to internal ShopFlow 12-digit format.
 * @param {string} barcode
 * @returns {boolean}
 */
function isValidBarcode(barcode) {
  if (typeof barcode !== 'string') return false;
  return /^\d{12}$/.test(barcode.trim());
}

/**
 * Extracts sequence number from a barcode if matching the prefix.
 * @param {string} barcode
 * @returns {number|null}
 */
function extractSequence(barcode) {
  if (typeof barcode !== 'string') return null;
  const trimmed = barcode.trim();
  if (trimmed.startsWith(BARCODE_PREFIX) && trimmed.length === BARCODE_PREFIX.length + SEQUENCE_LENGTH) {
    const seqStr = trimmed.slice(BARCODE_PREFIX.length);
    const num = parseInt(seqStr, 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Formats a sequence number into the candidate barcode string.
 * @param {number} sequenceNumber
 * @returns {string}
 */
function formatBarcode(sequenceNumber) {
  return `${BARCODE_PREFIX}${String(sequenceNumber).padStart(SEQUENCE_LENGTH, '0')}`;
}

/**
 * Generates the next unique internal barcode string for a given shop.
 *
 * @param {string} shopId - Shop ID
 * @param {Array<string>|Set<string>|Function} existingOrChecker - Existing barcodes or an async/sync checker function
 * @returns {Promise<string>} Next unique barcode string
 */
async function generateNextBarcode(shopId, existingOrChecker) {
  let isBarcodeTaken;

  if (typeof existingOrChecker === 'function') {
    isBarcodeTaken = existingOrChecker;
  } else if (existingOrChecker instanceof Set) {
    isBarcodeTaken = (candidate) => existingOrChecker.has(candidate);
  } else if (Array.isArray(existingOrChecker)) {
    const set = new Set(existingOrChecker.map((b) => String(b).trim()));
    isBarcodeTaken = (candidate) => set.has(candidate);
  } else {
    isBarcodeTaken = () => false;
  }

  // Determine starting sequence based on existing barcodes if list was provided
  let startSeq = 1;
  if (Array.isArray(existingOrChecker) || existingOrChecker instanceof Set) {
    let maxFound = 0;
    for (const b of existingOrChecker) {
      const seq = extractSequence(b);
      if (seq !== null && seq > maxFound) {
        maxFound = seq;
      }
    }
    startSeq = maxFound + 1;
  }

  let currentSeq = startSeq;
  let attempts = 0;

  while (attempts < MAX_COLLISION_RETRIES) {
    const candidate = formatBarcode(currentSeq);
    const taken = await isBarcodeTaken(candidate, shopId);

    if (!taken) {
      return candidate;
    }

    currentSeq += 1;
    attempts += 1;
  }

  // Fallback timestamp-based sequence if dense sequence collisions occur
  const timestampSeq = Math.floor(Date.now() / 1000) % 1000000;
  return formatBarcode(timestampSeq);
}

/**
 * Generates a PNG barcode image buffer using Code 128 with human-readable text.
 *
 * @param {string} barcode - Barcode text to encode
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateBarcodeImage(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    throw new Error('Valid barcode string is required to generate image');
  }

  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: barcode.trim(),
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
    paddingwidth: 10,
    paddingheight: 8,
    backgroundcolor: 'ffffff',
  });

  return pngBuffer;
}

module.exports = {
  BARCODE_PREFIX,
  SEQUENCE_LENGTH,
  isValidBarcode,
  extractSequence,
  formatBarcode,
  generateNextBarcode,
  generateBarcodeImage,
};
