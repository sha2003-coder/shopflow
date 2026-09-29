import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import posService from '../services/posService';
import salesService from '../services/salesService';
import POSCart from '../components/POSCart';
import BarcodeScanner from '../components/BarcodeScanner';
import {
  calculateSubtotal,
  calculateOverallDiscount,
  calculateGrandTotal,
  calculateChange,
  formatCurrency,
} from '../utils/cartCalculations';

/**
 * POS / Billing Page Component (/pos)
 * Fast, keyboard-friendly point-of-sale billing interface.
 * Supports USB barcode scanning, manual search, cart management,
 * live stock validation, discounts, and payment calculation.
 */
export default function POS() {
  const { currentUser, currentShop, userProfile, getIdToken, logout } = useAuth();
  const navigate = useNavigate();

  // Shop details
  const shopName = currentShop?.name || 'ShopFlow Store';
  const currency = currentShop?.currency || 'Rs.';
  const cashierName = currentShop?.ownerName || userProfile?.name || currentUser?.displayName || 'Cashier';

  // Scanner & Search input state
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [scanMessage, setScanMessage] = useState(null); // { type: 'success' | 'error' | 'warning', text: string }

  // Camera Barcode Scanner state
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScannerStatus, setCameraScannerStatus] = useState(null); // { type: 'success' | 'error' | 'warning', text: string }
  const [isCameraProcessing, setIsCameraProcessing] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState([]);

  // Discount state
  const [discountType, setDiscountType] = useState('amount'); // 'amount' | 'percentage'
  const [discountValue, setDiscountValue] = useState('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'Card' | 'Other'
  const [amountReceived, setAmountReceived] = useState('');

  // Sale completion status
  const [saleStatus, setSaleStatus] = useState(null); // { type: 'success' | 'error', title?: string, message: string }
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Input ref for barcode scanner focus retention
  const searchInputRef = useRef(null);

  // Focus scanner input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const focusScannerInput = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Flash a temporary alert
  const showFeedback = useCallback((type, text) => {
    setScanMessage({ type, text });
    setTimeout(() => {
      setScanMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Open and close camera scanner modal with focus management
  const openCameraScanner = useCallback(() => {
    setCameraScannerStatus(null);
    setIsCameraScannerOpen(true);
  }, []);

  const closeCameraScanner = useCallback(() => {
    setIsCameraScannerOpen(false);
    setCameraScannerStatus(null);
    // Return focus to existing barcode/search input (Requirement 15)
    setTimeout(() => {
      focusScannerInput();
    }, 100);
  }, [focusScannerInput]);

  // Handle barcode scanned from camera stream
  const handleCameraBarcodeScanned = useCallback(
    async (rawBarcode) => {
      const barcode = String(rawBarcode || '').trim();
      if (!barcode) {
        return { success: false, message: 'Invalid barcode string' };
      }

      setIsCameraProcessing(true);
      try {
        const token = await getIdToken();
        let product = null;

        try {
          product = await posService.lookupBarcode(barcode, token);
        } catch (err) {
          if (err.statusCode === 404 || err.message?.toLowerCase().includes('not found')) {
            const notFoundMsg = `Product not found. Barcode: ${barcode}`;
            setCameraScannerStatus({ type: 'error', text: notFoundMsg });
            showFeedback('error', notFoundMsg);
            return { success: false, message: notFoundMsg };
          }
          throw err;
        }

        if (!product) {
          const notFoundMsg = `Product not found. Barcode: ${barcode}`;
          setCameraScannerStatus({ type: 'error', text: notFoundMsg });
          showFeedback('error', notFoundMsg);
          return { success: false, message: notFoundMsg };
        }

        // Stock validation (Requirement 8)
        const stock = Number(product.stockQuantity ?? product.availableStock ?? 0);
        if (stock <= 0) {
          const outOfStockMsg = 'Product is out of stock.';
          setCameraScannerStatus({ type: 'error', text: `"${product.name}": ${outOfStockMsg}` });
          showFeedback('error', `"${product.name}" is out of stock.`);
          return { success: false, message: outOfStockMsg };
        }

        let scanResult = { success: true, message: '' };

        // Automatic cart addition & quantity increment (Requirements 7 & 9)
        setCartItems((prevItems) => {
          const existingIndex = prevItems.findIndex((item) => item.productId === product.id);

          if (existingIndex >= 0) {
            const current = prevItems[existingIndex];
            if (current.quantity + 1 > current.availableStock) {
              const insufficientMsg = 'Insufficient stock.';
              scanResult = { success: false, message: insufficientMsg };
              setCameraScannerStatus({
                type: 'warning',
                text: `${insufficientMsg} "${product.name}" (Max: ${current.availableStock})`,
              });
              showFeedback(
                'warning',
                `Insufficient stock for "${product.name}". Max available is ${current.availableStock}.`
              );
              return prevItems;
            }

            const updated = [...prevItems];
            const newQty = current.quantity + 1;
            updated[existingIndex] = {
              ...current,
              quantity: newQty,
            };

            const successMsg = `✓ Added another "${product.name}" (Qty: ${newQty})`;
            scanResult = { success: true, message: successMsg };
            setCameraScannerStatus({ type: 'success', text: successMsg });
            showFeedback('success', successMsg);
            return updated;
          }

          // New product row in cart
          const newItem = {
            productId: product.id,
            name: product.name,
            sku: product.sku || 'N/A',
            barcode: product.barcode || barcode,
            sellingPrice: Number(product.sellingPrice) || 0,
            availableStock: stock,
            quantity: 1,
            itemDiscount: 0,
          };

          const successMsg = `✓ "${product.name}" added`;
          scanResult = { success: true, message: successMsg };
          setCameraScannerStatus({ type: 'success', text: successMsg });
          showFeedback('success', successMsg);
          return [...prevItems, newItem];
        });

        return scanResult;
      } catch (err) {
        console.error('[POS] Camera barcode scan error:', err);
        const errMsg = err.message || 'Error looking up barcode';
        setCameraScannerStatus({ type: 'error', text: errMsg });
        showFeedback('error', errMsg);
        return { success: false, message: errMsg };
      } finally {
        setIsCameraProcessing(false);
      }
    },
    [getIdToken, showFeedback]
  );

  // Add a product object to cart
  const addProductToCart = useCallback(
    (product) => {
      const stock = Number(product.stockQuantity ?? product.availableStock ?? 0);

      if (stock <= 0) {
        showFeedback('error', `"${product.name}" is out of stock!`);
        focusScannerInput();
        return;
      }

      setCartItems((prevItems) => {
        const existingIndex = prevItems.findIndex((item) => item.productId === product.id);

        if (existingIndex >= 0) {
          const current = prevItems[existingIndex];
          if (current.quantity + 1 > current.availableStock) {
            showFeedback('warning', `Insufficient stock for "${product.name}". Max available is ${current.availableStock}.`);
            return prevItems;
          }

          const updated = [...prevItems];
          updated[existingIndex] = {
            ...current,
            quantity: current.quantity + 1,
          };
          showFeedback('success', `Added another "${product.name}" (Qty: ${updated[existingIndex].quantity})`);
          return updated;
        }

        // Add fresh cart row
        const newItem = {
          productId: product.id,
          name: product.name,
          sku: product.sku || 'N/A',
          barcode: product.barcode || '',
          sellingPrice: Number(product.sellingPrice) || 0,
          availableStock: stock,
          quantity: 1,
          itemDiscount: 0,
        };

        showFeedback('success', `Added "${product.name}" to cart`);
        return [...prevItems, newItem];
      });

      // Clear search results and refocus input
      setSearchInput('');
      setSearchResults([]);
      focusScannerInput();
    },
    [focusScannerInput, showFeedback]
  );

  // Handle barcode submission (e.g. Enter pressed by keyboard or USB barcode scanner)
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    try {
      setSearching(true);
      const token = await getIdToken();

      // First attempt direct barcode lookup
      try {
        const product = await posService.lookupBarcode(query, token);
        if (product) {
          addProductToCart(product);
          return;
        }
      } catch (err) {
        // Not found by direct barcode, fallback to text search
        if (err.statusCode !== 404) {
          console.warn('[POS] Barcode lookup error:', err.message);
        }
      }

      // If barcode lookup was not matched, try searching catalog
      const matches = await posService.searchProducts(query, token);
      if (matches.length === 1) {
        // Exact single match found
        addProductToCart(matches[0]);
      } else if (matches.length > 1) {
        setSearchResults(matches);
        showFeedback('warning', `Found ${matches.length} matching products. Click to select.`);
      } else {
        showFeedback('error', 'Product not found');
        focusScannerInput();
      }
    } catch (err) {
      console.error('[POS] Lookup failed:', err);
      showFeedback('error', err.message || 'Lookup failed');
      focusScannerInput();
    } finally {
      setSearching(false);
    }
  };

  // Debounced search on typing
  useEffect(() => {
    const term = searchInput.trim();
    if (!term || term.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const token = await getIdToken();
        const results = await posService.searchProducts(term, token);
        setSearchResults(results);
      } catch (err) {
        console.error('[POS] Live search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, getIdToken]);

  // Cart item management
  const handleUpdateQuantity = (productId, newQuantity) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleUpdateItemDiscount = (productId, newDiscount) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, itemDiscount: newDiscount } : item
      )
    );
  };

  const handleRemoveItem = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
    focusScannerInput();
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('Are you sure you want to clear the entire cart?')) {
      setCartItems([]);
      setDiscountValue('');
      setAmountReceived('');
      setSaleStatus(null);
      setScanMessage(null);
      focusScannerInput();
    }
  };

  // Calculations
  const subtotal = calculateSubtotal(cartItems);
  const { discountAmount, error: discountError } = calculateOverallDiscount(
    subtotal,
    discountType,
    discountValue
  );
  const grandTotal = calculateGrandTotal(subtotal, discountAmount);
  const { change, isShort, shortAmount } = calculateChange(
    grandTotal,
    paymentMethod === 'Cash' ? amountReceived : grandTotal
  );

  // Complete Sale execution with real backend transaction
  const handleCompleteSale = async () => {
    setSaleStatus(null);

    if (cartItems.length === 0) {
      setSaleStatus({
        type: 'error',
        title: 'Cart is empty',
        message: 'Please add at least one product before completing sale.',
      });
      return;
    }

    if (paymentMethod === 'Cash') {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received <= 0) {
        setSaleStatus({
          type: 'error',
          title: 'Amount Required',
          message: 'Please enter the amount received from the customer.',
        });
        return;
      }
      if (received < grandTotal) {
        setSaleStatus({
          type: 'error',
          title: 'Insufficient Payment',
          message: `Amount received (${formatCurrency(received, currency)}) is less than Grand Total (${formatCurrency(grandTotal, currency)}). Short by ${formatCurrency(shortAmount, currency)}.`,
        });
        return;
      }
    }

    setIsSubmittingSale(true);

    try {
      const token = await getIdToken();
      const payload = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          itemDiscount: item.itemDiscount || 0,
        })),
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        paymentMethod: paymentMethod.toLowerCase(),
        amountReceived: paymentMethod === 'Cash' ? parseFloat(amountReceived) : grandTotal,
      };

      const response = await salesService.createSale(payload, token);
      const sale = response.sale;

      // Format receipt summary
      const changeText =
        sale.paymentMethod === 'cash'
          ? `\nChange: ${formatCurrency(sale.changeAmount, currency)}`
          : '';

      setSaleStatus({
        type: 'success',
        title: 'Sale Completed Successfully',
        message: `Invoice: ${sale.invoiceNumber}\nTotal: ${formatCurrency(sale.grandTotal, currency)}${changeText}`,
        sale,
      });

      // Clear cart on successful sale
      setCartItems([]);
      setDiscountValue('');
      setAmountReceived('');

      // Refresh product search/stock if search is active
      if (searchInput.trim()) {
        try {
          const refreshed = await posService.searchProducts(searchInput.trim(), token);
          setSearchResults(refreshed);
        } catch {
          // ignore
        }
      }

      // Return focus to barcode/search input
      focusScannerInput();
    } catch (err) {
      console.error('[POS] Checkout failed:', err);
      let errorMsg = err.message || 'An error occurred during checkout.';
      if (err.product && err.availableStock !== undefined) {
        errorMsg = `Insufficient stock for "${err.product}". Available: ${err.availableStock}, Requested: ${err.requestedQuantity}.`;
      }
      // Keep cart intact so cashier can adjust
      setSaleStatus({
        type: 'error',
        title: 'Checkout Failed',
        message: errorMsg,
      });
    } finally {
      setIsSubmittingSale(false);
    }
  };

  return (
    <div className="pos-page" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      {/* Top Header */}
      <header
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            💳
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                POS / Billing
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontWeight: 600,
                }}
              >
                Ready
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Shop: <strong style={{ color: 'var(--text-primary)' }}>{shopName}</strong> | Cashier: {cashierName}
            </div>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Dashboard
          </Link>
          <Link
            to="/products"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Products
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
          >
            POS
          </button>
          <Link
            to="/sales"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Sales
          </Link>
          <button
            type="button"
            onClick={() => alert('Reports module will be available in the upcoming release.')}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', opacity: 0.6 }}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: '#ef4444' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid: Left (Scanner & Catalog) vs Right (Cart & Checkout) */}
      <div
        className="pos-layout-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* ========================================================
            LEFT COLUMN: Scanner, Search Input & Search Results
            ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Barcode Scanner / Search Box */}
          <div
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <form onSubmit={handleBarcodeSubmit}>
              <label
                htmlFor="pos-scanner-input"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                Scan barcode or search product...
              </label>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <input
                    id="pos-scanner-input"
                    ref={searchInputRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSearchInput(v);
                      if (!v.trim() || v.trim().length < 2) {
                        setSearchResults([]);
                      }
                    }}
                    placeholder="Scan barcode or type name / SKU..."
                    className="form-input"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      fontSize: '1rem',
                      borderColor: searching ? 'var(--accent-primary)' : undefined,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '1.1rem',
                      opacity: 0.6,
                    }}
                  >
                    🔍
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={searching || !searchInput.trim()}
                  className="btn btn-primary"
                  style={{ minWidth: '90px' }}
                >
                  {searching ? 'Finding...' : 'Add'}
                </button>

                <button
                  type="button"
                  id="pos-camera-scan-btn"
                  onClick={openCameraScanner}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: 'rgba(99, 102, 241, 0.12)',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    color: '#a5b4fc',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                  title="Open camera to scan barcodes"
                >
                  <span role="img" aria-label="camera" style={{ fontSize: '1.1rem' }}>
                    📷
                  </span>
                  Scan Barcode
                </button>
              </div>
            </form>

            {/* Scan / Status Feedback Banner */}
            {scanMessage && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background:
                    scanMessage.type === 'success'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : scanMessage.type === 'warning'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    scanMessage.type === 'success'
                      ? '#10b981'
                      : scanMessage.type === 'warning'
                      ? '#fbbf24'
                      : '#ef4444',
                  border: `1px solid ${
                    scanMessage.type === 'success'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : scanMessage.type === 'warning'
                      ? 'rgba(234, 179, 8, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'
                  }`,
                }}
              >
                {scanMessage.text}
              </div>
            )}
          </div>

          {/* Search Results Catalog Panel */}
          {searchResults.length > 0 && (
            <div
              style={{
                background: 'var(--bg-card)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                maxHeight: '480px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Matching Products ({searchResults.length})
                </div>
                <button
                  type="button"
                  onClick={() => setSearchResults([])}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear results
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {searchResults.map((product) => {
                  const stock = Number(product.stockQuantity || 0);
                  const isOut = stock <= 0;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOut && addProductToCart(product)}
                      style={{
                        padding: '0.85rem',
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-md)',
                        cursor: isOut ? 'not-allowed' : 'pointer',
                        opacity: isOut ? 0.5 : 1,
                        transition: 'transform 0.1s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isOut) {
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {product.name}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        SKU: {product.sku}
                      </div>

                      {product.barcode && (
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          Barcode: {product.barcode}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingTop: '0.4rem',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#34d399', fontSize: '1rem' }}>
                          {formatCurrency(product.sellingPrice, currency)}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isOut ? '#ef4444' : stock <= Number(product.lowStockLevel) ? '#fbbf24' : 'var(--text-muted)',
                          }}
                        >
                          {isOut ? 'Out of stock' : `Stock: ${stock}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick instructions / tips panel */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              💡 Dual Scanner Modes
            </div>
            • <strong>USB / Handheld Barcode Scanner:</strong> Scan anytime while the search box is active for instant entry.<br />
            • <strong>Camera Barcode Scanner:</strong> Click <strong>📷 Scan Barcode</strong> to scan Code 128 / retail barcodes directly with your phone, tablet, or webcam in continuous mode.
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN: Cart Table, Discount, Summary & Payment
            ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Cart Table Container */}
          <div
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Billing Cart ({cartItems.reduce((acc, item) => acc + item.quantity, 0)} items)
              </h2>

              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  Clear Cart
                </button>
              )}
            </div>

            <POSCart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdateItemDiscount={handleUpdateItemDiscount}
              onRemoveItem={handleRemoveItem}
              currency={currency}
            />
          </div>

          {/* Checkout & Bill Summary Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Bill Summary & Payment
            </h3>

            {/* Overall Discount Selector */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '1rem',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Discount:
              </span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  padding: '4px 6px',
                }}
              >
                <option value="amount">Fixed Amount ({currency})</option>
                <option value="percentage">Percentage (%)</option>
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder={discountType === 'percentage' ? '10%' : '0.00'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  padding: '4px 8px',
                  textAlign: 'right',
                }}
              />
            </div>
            {discountError && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
                {discountError}
              </div>
            )}

            {/* Calculations Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>

              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', fontSize: '0.9rem' }}>
                  <span>Overall Discount:</span>
                  <span>- {formatCurrency(discountAmount, currency)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.75rem',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>Grand Total:</span>
                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.4rem',
                }}
              >
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card</option>
                <option value="Other">📱 Other (Bank / Online)</option>
              </select>
            </div>

            {/* Cash Tendered & Change Section */}
            {paymentMethod === 'Cash' && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.25rem',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.4rem',
                  }}
                >
                  Amount Received
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700 }}
                />

                <div
                  style={{
                    marginTop: '0.65rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                >
                  <span>Change Due:</span>
                  <span
                    style={{
                      color: isShort ? '#ef4444' : '#10b981',
                      fontSize: '1.1rem',
                    }}
                  >
                    {isShort && Number(amountReceived) > 0
                      ? `Short by ${formatCurrency(shortAmount, currency)}`
                      : formatCurrency(change, currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Complete Sale Status Message */}
            {saleStatus && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  marginBottom: '1rem',
                  background:
                    saleStatus.type === 'success'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color: saleStatus.type === 'success' ? '#10b981' : '#ef4444',
                  border: `1px solid ${
                    saleStatus.type === 'success'
                      ? 'rgba(16, 185, 129, 0.4)'
                      : 'rgba(239, 68, 68, 0.4)'
                  }`,
                }}
              >
                {saleStatus.title && (
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                    {saleStatus.title}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                  {saleStatus.message}
                </div>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={cartItems.length === 0 || isSubmittingSale}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1.05rem',
                fontWeight: 700,
                justifyContent: 'center',
                opacity: cartItems.length === 0 || isSubmittingSale ? 0.5 : 1,
                cursor: cartItems.length === 0 || isSubmittingSale ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmittingSale ? '⏳ Processing Sale...' : '✅ Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal (Continuous hands-free scanning) */}
      <BarcodeScanner
        isOpen={isCameraScannerOpen}
        onClose={closeCameraScanner}
        onScan={handleCameraBarcodeScanned}
        statusMessage={cameraScannerStatus}
        isProcessing={isCameraProcessing}
      />
    </div>
  );
}
