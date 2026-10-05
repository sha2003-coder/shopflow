import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSalesReport } from '../services/reportService';
import { formatCurrency } from '../utils/cartCalculations';
import ReportSummaryCard from '../components/ReportSummaryCard';
import SalesTrendChart from '../components/SalesTrendChart';
import TopProductsTable from '../components/TopProductsTable';
import LowStockTable from '../components/LowStockTable';

/**
 * Helper to format a Date into 'YYYY-MM-DD'
 */
function formatDateToYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates start and end YYYY-MM-DD for preset filters
 */
function getQuickFilterRange(filterKey) {
  const now = new Date();
  const todayStr = formatDateToYYYYMMDD(now);

  switch (filterKey) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = formatDateToYYYYMMDD(yesterday);
      return { startDate: yStr, endDate: yStr };
    }

    case 'last7': {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      return { startDate: formatDateToYYYYMMDD(past7), endDate: todayStr };
    }

    case 'thisMonth': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDateToYYYYMMDD(firstOfMonth), endDate: todayStr };
    }

    case 'lastMonth': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: formatDateToYYYYMMDD(firstOfLastMonth),
        endDate: formatDateToYYYYMMDD(lastOfLastMonth),
      };
    }

    default:
      return { startDate: todayStr, endDate: todayStr };
  }
}

export default function Reports() {
  const { currentShop, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const currency = currentShop?.currency || 'Rs.';

  // Quick filter presets
  const [activeFilter, setActiveFilter] = useState('today');

  // Start Date and End Date inputs (default Today)
  const initialRange = getQuickFilterRange('today');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  // Report state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  /**
   * Loads report data from backend API
   */
  const fetchReport = useCallback(
    async (start, end) => {
      if (!currentUser) return;
      try {
        setLoading(true);
        setError(null);

        const token = await currentUser.getIdToken();
        const response = await getSalesReport(
          {
            startDate: start,
            endDate: end,
            tzOffset: new Date().getTimezoneOffset(),
          },
          token
        );

        if (response.success && response.report) {
          setReportData(response.report);
        } else {
          throw new Error('Unable to load reports. Please try again.');
        }
      } catch (err) {
        console.error('[Reports Page] Load error:', err);
        setError('Unable to load reports. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  // Fetch report on mount and whenever startDate / endDate changes
  useEffect(() => {
    fetchReport(startDate, endDate);
  }, [startDate, endDate, fetchReport]);

  /**
   * Handles Quick Filter selection
   */
  const handleQuickFilterClick = (filterKey) => {
    setActiveFilter(filterKey);
    if (filterKey !== 'custom') {
      const range = getQuickFilterRange(filterKey);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  /**
   * Handles Manual Date Change
   */
  const handleDateChange = (field, value) => {
    setActiveFilter('custom');
    if (field === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Safe destructuring of report metrics
  const summary = reportData?.summary || {
    totalSales: 0,
    billCount: 0,
    itemsSold: 0,
    averageBill: 0,
  };

  const paymentMethods = reportData?.paymentMethods || {
    cash: 0,
    card: 0,
    other: 0,
    counts: { cash: 0, card: 0, other: 0 },
  };

  const topProducts = reportData?.topProducts || [];
  const dailySales = reportData?.dailySales || [];
  const lowStockProducts = reportData?.lowStockProducts || [];
  const outOfStockProducts = reportData?.outOfStockProducts || [];
  const inventorySummary = reportData?.inventorySummary || {
    totalProducts: 0,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
  };

  const totalPaymentSum = (paymentMethods.cash || 0) + (paymentMethods.card || 0) + (paymentMethods.other || 0);
  const cashPct = totalPaymentSum > 0 ? Math.round((paymentMethods.cash / totalPaymentSum) * 100) : 0;
  const cardPct = totalPaymentSum > 0 ? Math.round((paymentMethods.card / totalPaymentSum) * 100) : 0;
  const otherPct = totalPaymentSum > 0 ? Math.max(0, 100 - cashPct - cardPct) : 0;

  return (
    <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ======================================================== */}
      {/* 1. TOP HEADER & NAVIGATION                               */}
      {/* ======================================================== */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            📊
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Reports & Analytics
            </h1>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {currentShop?.name || 'ShopFlow Store'} &bull; Business Performance Overview
            </p>
          </div>
        </div>

        {/* Global Navigation Links */}
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
          <Link
            to="/pos"
            className="btn btn-secondary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              textDecoration: 'none',
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.35)',
            }}
          >
            💳 POS
          </Link>
          <Link
            to="/sales"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Sales
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.85rem',
              background: 'var(--accent-gradient)',
              fontWeight: 600,
            }}
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

      {/* ======================================================== */}
      {/* 2. DATE-RANGE FILTER TOOLBAR                             */}
      {/* ======================================================== */}
      <section
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginRight: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Filter:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'lastMonth', label: 'Last Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map((qf) => {
              const isActive = activeFilter === qf.id;
              return (
                <button
                  key={qf.id}
                  type="button"
                  onClick={() => handleQuickFilterClick(qf.id)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: isActive ? '#f8fafc' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {qf.label}
                </button>
              );
            })}
          </div>

          {/* Refresh / Status */}
          <button
            type="button"
            onClick={() => fetchReport(startDate, endDate)}
            disabled={loading}
            className="btn btn-secondary"
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            🔄 {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Date Pickers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="report-start-date" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Start Date:
            </label>
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.65rem',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-main)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="report-end-date" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              End Date:
            </label>
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.65rem',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-main)',
                outline: 'none',
              }}
            />
          </div>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Active Range: <strong style={{ color: 'var(--text-primary)' }}>{startDate}</strong> to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{endDate}</strong>
          </span>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. ERROR & LOADING STATES                                */}
      {/* ======================================================== */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#f87171',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchReport(startDate, endDate)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#f87171' }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '5rem 0',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              border: '3px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Loading reports...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* 4. SUMMARY METRIC CARDS ROW                              */}
          {/* ======================================================== */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.75rem',
            }}
          >
            <ReportSummaryCard
              title="Total Sales"
              value={formatCurrency(summary.totalSales, currency)}
              subtitle={`${summary.billCount} completed transaction${summary.billCount === 1 ? '' : 's'}`}
              icon="💰"
              accentColor="linear-gradient(135deg, #10b981 0%, #059669 100%)"
              badgeText={summary.billCount > 0 ? 'Revenue' : 'No Sales'}
              badgeType={summary.billCount > 0 ? 'success' : 'info'}
            />

            <ReportSummaryCard
              title="Number of Bills"
              value={summary.billCount}
              subtitle="Completed invoices issued"
              icon="🧾"
              accentColor="linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
              badgeText="Invoices"
              badgeType="info"
            />

            <ReportSummaryCard
              title="Items Sold"
              value={summary.itemsSold}
              subtitle="Total product units sold"
              icon="📦"
              accentColor="linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)"
              badgeText="Units"
              badgeType="info"
            />

            <ReportSummaryCard
              title="Average Bill Value"
              value={formatCurrency(summary.averageBill, currency)}
              subtitle="Total sales / number of bills"
              icon="📊"
              accentColor="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              badgeText={summary.billCount > 0 ? 'Avg / Bill' : 'Rs. 0.00'}
              badgeType="warning"
            />
          </section>

          {/* ======================================================== */}
          {/* 5. PAYMENT METHOD BREAKDOWN                              */}
          {/* ======================================================== */}
          <section
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '1.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  💳 Payment Method Summary
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                  Distribution of completed revenue by tender type
                </p>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalPaymentSum, currency)}</strong>
              </span>
            </div>

            {/* Grid of payment cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              {/* Cash */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>💵 Cash</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {paymentMethods.counts?.cash || 0} bill{paymentMethods.counts?.cash === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: '0.5rem 0 0.25rem 0' }}>
                  {formatCurrency(paymentMethods.cash, currency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cashPct}% of total sales</div>
              </div>

              {/* Card */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>💳 Card</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {paymentMethods.counts?.card || 0} bill{paymentMethods.counts?.card === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: '0.5rem 0 0.25rem 0' }}>
                  {formatCurrency(paymentMethods.card, currency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cardPct}% of total sales</div>
              </div>

              {/* Other */}
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.05)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c084fc' }}>🔄 Other</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {paymentMethods.counts?.other || 0} bill{paymentMethods.counts?.other === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: '0.5rem 0 0.25rem 0' }}>
                  {formatCurrency(paymentMethods.other, currency)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{otherPct}% of total sales</div>
              </div>
            </div>

            {/* Visual ratio progress bar */}
            {totalPaymentSum > 0 && (
              <div
                style={{
                  height: '8px',
                  width: '100%',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{ width: `${cashPct}%`, background: '#10b981', transition: 'width 0.4s ease' }}
                  title={`Cash: ${cashPct}%`}
                />
                <div
                  style={{ width: `${cardPct}%`, background: '#0284c7', transition: 'width 0.4s ease' }}
                  title={`Card: ${cardPct}%`}
                />
                <div
                  style={{ width: `${otherPct}%`, background: '#a855f7', transition: 'width 0.4s ease' }}
                  title={`Other: ${otherPct}%`}
                />
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* 6. DAILY SALES TREND CHART                               */}
          {/* ======================================================== */}
          <section style={{ marginBottom: '1.75rem' }}>
            <SalesTrendChart data={dailySales} currency={currency} />
          </section>

          {/* ======================================================== */}
          {/* 7. TOP SELLING PRODUCTS                                  */}
          {/* ======================================================== */}
          <section style={{ marginBottom: '1.75rem' }}>
            <TopProductsTable products={topProducts} currency={currency} />
          </section>

          {/* ======================================================== */}
          {/* 8. LOW-STOCK & INVENTORY REPORT                          */}
          {/* ======================================================== */}
          <section>
            <LowStockTable
              products={lowStockProducts}
              outOfStockCount={inventorySummary.outOfStockCount}
              lowStockCount={inventorySummary.lowStockCount}
            />
          </section>
        </>
      )}
    </div>
  );
}
