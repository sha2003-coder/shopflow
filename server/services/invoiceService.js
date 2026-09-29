const { db, hasFullServiceAccount } = require('../config/firebaseAdmin');
const { fallbackStore } = require('./shopService');

/**
 * Invoice Number Service
 * Generates predictable, human-friendly, shop-specific sequential invoice numbers.
 * Format: "INV-000001", "INV-000002", etc.
 * Uses atomic Firestore transactions to ensure concurrency safety.
 */

const INVOICE_PREFIX = 'INV-';
const SEQUENCE_PADDING = 6;

/**
 * Formats a sequence integer into a standard invoice string.
 * @param {number} seq
 * @returns {string}
 */
function formatInvoiceNumber(seq) {
  const num = Math.max(1, parseInt(seq, 10) || 1);
  return `${INVOICE_PREFIX}${String(num).padStart(SEQUENCE_PADDING, '0')}`;
}

/**
 * Gets and increments the next invoice number for a shop within a Firestore transaction.
 * Target document: shops/{shopId}/counters/sales
 *
 * @param {string} shopId - ID of the shop
 * @param {FirebaseFirestore.Transaction} [transaction] - Active Firestore transaction
 * @returns {Promise<{ invoiceNumber: string, sequenceNumber: number }>}
 */
async function getNextInvoiceNumber(shopId, transaction = null) {
  if (!shopId) {
    throw new Error('Shop ID is required to generate invoice number');
  }

  // 1. Transactional generation with Admin SDK
  if (hasFullServiceAccount && db && transaction) {
    const counterRef = db
      .collection('shops')
      .doc(shopId)
      .collection('counters')
      .doc('sales');

    const counterDoc = await transaction.get(counterRef);
    let lastSeq = 0;
    if (counterDoc.exists && typeof counterDoc.data().lastInvoiceNumber === 'number') {
      lastSeq = counterDoc.data().lastInvoiceNumber;
    }

    const nextSeq = lastSeq + 1;
    transaction.set(counterRef, {
      lastInvoiceNumber: nextSeq,
      updatedAt: new Date(),
    }, { merge: true });

    return {
      invoiceNumber: formatInvoiceNumber(nextSeq),
      sequenceNumber: nextSeq,
    };
  }

  // 2. Non-transactional fallback using Admin SDK (e.g. if called outside transaction)
  if (hasFullServiceAccount && db && !transaction) {
    const counterRef = db
      .collection('shops')
      .doc(shopId)
      .collection('counters')
      .doc('sales');

    return await db.runTransaction(async (t) => {
      const counterDoc = await t.get(counterRef);
      let lastSeq = 0;
      if (counterDoc.exists && typeof counterDoc.data().lastInvoiceNumber === 'number') {
        lastSeq = counterDoc.data().lastInvoiceNumber;
      }
      const nextSeq = lastSeq + 1;
      t.set(counterRef, {
        lastInvoiceNumber: nextSeq,
        updatedAt: new Date(),
      }, { merge: true });

      return {
        invoiceNumber: formatInvoiceNumber(nextSeq),
        sequenceNumber: nextSeq,
      };
    });
  }

  // 3. In-memory fallback repository for local/isolated testing
  const currentSeq = fallbackStore.counters.get(shopId) || 0;
  const nextSeq = currentSeq + 1;
  fallbackStore.counters.set(shopId, nextSeq);

  return {
    invoiceNumber: formatInvoiceNumber(nextSeq),
    sequenceNumber: nextSeq,
  };
}

module.exports = {
  INVOICE_PREFIX,
  SEQUENCE_PADDING,
  formatInvoiceNumber,
  getNextInvoiceNumber,
};
