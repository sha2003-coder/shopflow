/**
 * Reusable POS Cart & Billing Calculation Utilities
 * Handles line totals, item discounts, overall cart discounts, grand totals, and cash change.
 */

/**
 * Calculates line total for an individual cart item.
 * Line total = (sellingPrice * quantity) - itemDiscount
 * Prevents line total from becoming negative.
 *
 * @param {number} price - Unit selling price
 * @param {number} quantity - Quantity of items (>= 1)
 * @param {number} [itemDiscount=0] - Discount applied specifically to this line item
 * @returns {number}
 */
export function calculateLineTotal(price, quantity, itemDiscount = 0) {
  const p = Math.max(0, Number(price) || 0);
  const q = Math.max(1, Number(quantity) || 1);
  const d = Math.max(0, Number(itemDiscount) || 0);
  const gross = p * q;
  return Math.max(0, gross - d);
}

/**
 * Calculates subtotal for all items in the cart.
 * Subtotal represents the sum of all item line totals before overall billing discount.
 *
 * @param {Array<Object>} items - Cart items
 * @returns {number}
 */
export function calculateSubtotal(items = []) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    return sum + calculateLineTotal(item.sellingPrice, item.quantity, item.itemDiscount);
  }, 0);
}

/**
 * Calculates overall billing discount amount based on type (percentage or fixed amount).
 * Validates constraints:
 * - Discount cannot be negative
 * - Percentage cannot exceed 100%
 * - Fixed amount cannot exceed subtotal
 *
 * @param {number} subtotal - Cart subtotal
 * @param {'amount'|'percentage'} discountType - Discount mode
 * @param {number|string} discountValue - Entered discount value
 * @returns {{ discountAmount: number, error: string|null }}
 */
export function calculateOverallDiscount(subtotal, discountType, discountValue) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const rawVal = Number(discountValue);

  if (isNaN(rawVal) || rawVal <= 0 || sub === 0) {
    return { discountAmount: 0, error: null };
  }

  if (discountType === 'percentage') {
    if (rawVal < 0) {
      return { discountAmount: 0, error: 'Discount percentage cannot be negative' };
    }
    if (rawVal > 100) {
      return { discountAmount: 0, error: 'Discount percentage cannot exceed 100%' };
    }
    const amount = (sub * rawVal) / 100;
    return { discountAmount: Math.round(amount * 100) / 100, error: null };
  }

  // Fixed Amount
  if (rawVal < 0) {
    return { discountAmount: 0, error: 'Discount amount cannot be negative' };
  }
  if (rawVal > sub) {
    return { discountAmount: 0, error: 'Discount amount cannot exceed the subtotal' };
  }
  return { discountAmount: rawVal, error: null };
}

/**
 * Calculates the Grand Total payable.
 * Grand Total = Subtotal - Overall Discount Amount
 *
 * @param {number} subtotal - Cart subtotal
 * @param {number} discountAmount - Overall discount deduction
 * @returns {number}
 */
export function calculateGrandTotal(subtotal, discountAmount = 0) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const disc = Math.max(0, Number(discountAmount) || 0);
  return Math.max(0, sub - disc);
}

/**
 * Calculates cash change to return to customer.
 * Change = Amount Received - Grand Total
 *
 * @param {number} grandTotal - Final amount payable
 * @param {number|string} amountReceived - Amount tendered by customer
 * @returns {{ change: number, isShort: boolean, shortAmount: number }}
 */
export function calculateChange(grandTotal, amountReceived) {
  const total = Math.max(0, Number(grandTotal) || 0);
  const received = Math.max(0, Number(amountReceived) || 0);

  if (received >= total) {
    return {
      change: Math.round((received - total) * 100) / 100,
      isShort: false,
      shortAmount: 0,
    };
  }

  return {
    change: 0,
    isShort: true,
    shortAmount: Math.round((total - received) * 100) / 100,
  };
}

/**
 * Formats a monetary value with proper currency symbol and two decimals.
 * Examples: formatCurrency(2500, 'Rs.') -> "Rs. 2,500.00"
 *
 * @param {number} amount
 * @param {string} [currency='Rs.']
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'Rs.') {
  const num = Number(amount) || 0;
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const curr = (currency || 'Rs.').trim();
  // If currency is a symbol like $, attach without space or with standard space
  if (['$', '€', '£', '¥'].includes(curr)) {
    return `${curr}${formattedNumber}`;
  }
  return `${curr} ${formattedNumber}`;
}
