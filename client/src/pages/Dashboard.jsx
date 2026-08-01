import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, API_URL, onViewChange, checkAuthFailure }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard metrics.');
      }
      const result = await res.json();
      setData(result);
      setLoading(false);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loadingContainer}>Loading dashboard statistics...</div>;
  }

  if (error) {
    return <div style={styles.errorContainer}>Error: {error}</div>;
  }

  const { metrics, lowStockList, recentSales, dailySalesChart } = data;

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  // Compute stats for the chart
  const maxSaleValue = dailySalesChart.length > 0
    ? Math.max(...dailySalesChart.map(day => day.total_sales), 100)
    : 100;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard Overview</h1>
          <p style={styles.subtitle}>Supermarket metrics and real-time operations summary.</p>
        </div>
        <button onClick={fetchDashboardData} className="btn btn-secondary" style={styles.refreshBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Low Stock Warning Banner */}
      {metrics.lowStockCount > 0 && (
        <div className="status-banner warning" style={styles.warningBanner}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div style={{flexGrow: 1}}>
            <h4 style={{color: 'var(--color-warning)', fontWeight: 600, fontSize: '15px'}}>Warehouse Alert: Low Stock Warning</h4>
            <p style={{fontSize: '13px', color: 'rgba(245, 158, 11, 0.85)', marginTop: '2px'}}>
              There are {metrics.lowStockCount} products that have fallen below their minimum stock thresholds.
            </p>
          </div>
          <button onClick={() => onViewChange('inventory')} className="btn btn-primary" style={{padding: '8px 16px', fontSize: '13px'}}>
            Go to Inventory
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid-4 mb-lg">
        <div className="glass-panel" style={styles.card}>
          <div style={styles.cardIconBox('info')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div style={styles.cardValue}>{formatCurrency(metrics.salesToday)}</div>
          <div style={styles.cardLabel}>Sales Today</div>
        </div>

        <div className="glass-panel" style={styles.card}>
          <div style={styles.cardIconBox('success')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div style={styles.cardValue}>{formatCurrency(metrics.salesMonth)}</div>
          <div style={styles.cardLabel}>Sales This Month</div>
        </div>

        <div className="glass-panel" style={styles.card}>
          <div style={styles.cardIconBox('primary')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div style={styles.cardValue}>{metrics.totalProducts}</div>
          <div style={styles.cardLabel}>Total Products</div>
        </div>

        <div className="glass-panel" style={{...styles.card, borderLeft: metrics.lowStockCount > 0 ? '3px solid var(--color-danger)' : '1px solid var(--glass-border)'}}>
          <div style={styles.cardIconBox('danger')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div style={{...styles.cardValue, color: metrics.lowStockCount > 0 ? 'var(--color-danger)' : 'var(--text-primary)'}}>{metrics.lowStockCount}</div>
          <div style={styles.cardLabel}>Low Stock Alert</div>
        </div>
      </div>

      <div style={styles.sectionsGrid}>
        {/* Weekly Trend Chart */}
        <div className="glass-panel" style={styles.panelSection}>
          <h3 style={styles.sectionTitle}>Weekly Sales Trend</h3>
          <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px'}}>Revenue earned across the past 7 active calendar days.</p>
          
          {dailySalesChart.length === 0 ? (
            <div style={styles.emptyChart}>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)', marginBottom: '8px'}}>
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
              <span>No transactions recorded in the last 7 days.</span>
            </div>
          ) : (
            <div style={styles.chartContainer}>
              <div style={styles.barChart}>
                {dailySalesChart.map((day) => {
                  const pct = (day.total_sales / maxSaleValue) * 100;
                  const dateLabel = new Date(day.sale_date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
                  return (
                    <div key={day.sale_date} style={styles.chartCol}>
                      <div style={styles.barWrapper}>
                        <div style={styles.barValue}>{formatCurrency(day.total_sales)}</div>
                        <div style={{...styles.barFill, height: `${Math.max(pct, 5)}%`}}></div>
                      </div>
                      <div style={styles.barLabel}>{dateLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Checklist */}
        <div className="glass-panel" style={styles.panelSection}>
          <h3 style={styles.sectionTitle}>Warehouse Critical Stocks</h3>
          <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px'}}>Top products requiring priority restock adjustments.</p>

          {lowStockList.length === 0 ? (
            <div style={styles.emptyCardList}>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--color-success)', marginBottom: '8px'}}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>All warehouse items are adequately stocked!</span>
            </div>
          ) : (
            <div style={styles.cardList}>
              {lowStockList.map((item) => (
                <div key={item.id} style={styles.cardListItem}>
                  <div style={styles.listItemText}>
                    <div style={styles.listItemName}>{item.name}</div>
                    <div style={styles.listItemSku}>SKU: {item.sku}</div>
                  </div>
                  <div style={styles.listItemStats}>
                    <div style={{fontWeight: 700, color: 'var(--color-danger)'}}>{item.stock} {item.unit}</div>
                    <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>Min threshold: {item.low_stock_threshold}</div>
                  </div>
                </div>
              ))}
              <button onClick={() => onViewChange('inventory')} className="btn btn-secondary w-full" style={{marginTop: '8px'}}>
                Manage Stock Restocking
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales Invoices Log */}
      <div className="glass-panel" style={{...styles.panelSection, marginTop: '24px'}}>
        <div style={styles.tableHeader}>
          <h3 style={styles.sectionTitle}>Recent Invoices</h3>
          <button onClick={() => onViewChange('reports')} className="btn btn-secondary" style={{padding: '6px 12px', fontSize: '13px'}}>
            View All Sales logs
          </button>
        </div>
        
        {recentSales.length === 0 ? (
          <div style={{textAlign: 'center', padding: '32px', color: 'var(--text-muted)'}}>
            No invoice transactions completed yet.
          </div>
        ) : (
          <div className="table-container" style={{marginTop: '16px'}}>
            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Cashier</th>
                  <th>Date & Time</th>
                  <th className="text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <code style={{color: 'var(--accent-primary)', fontWeight: '600'}}>{sale.invoice_number}</code>
                    </td>
                    <td>{sale.cashier_name}</td>
                    <td>{new Date(sale.created_at + 'Z').toLocaleString()}</td>
                    <td className="text-right" style={{fontWeight: '700', color: 'var(--color-success)'}}>
                      {formatCurrency(sale.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '32px',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%'
  },
  header: {
    display: 'flex',
    justifyContent: 'between',
    alignItems: 'center',
    marginBottom: '28px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '800'
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px'
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  warningBanner: {
    marginTop: '12px'
  },
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-secondary)',
    minHeight: '130px'
  },
  cardIconBox: (type) => {
    const colors = {
      primary: { bg: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' },
      success: { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' },
      danger: { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' },
      info: { bg: 'rgba(14, 165, 233, 0.1)', color: 'var(--color-info)' }
    };
    const c = colors[type] || colors.primary;
    return {
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
      color: c.color,
      marginBottom: '16px'
    };
  },
  cardValue: {
    fontSize: '26px',
    fontWeight: '800',
    lineHeight: '1.2'
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    marginTop: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  sectionsGrid: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '24px'
  },
  panelSection: {
    padding: '28px',
    backgroundColor: 'var(--bg-secondary)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700'
  },
  emptyChart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: 'var(--text-muted)',
    fontSize: '14px'
  },
  chartContainer: {
    height: '240px',
    display: 'flex',
    alignItems: 'flex-end',
    paddingTop: '20px'
  },
  barChart: {
    display: 'flex',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px'
  },
  chartCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexGrow: 1,
    height: '100%',
    justifyContent: 'flex-end'
  },
  barWrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '80%',
    justifyContent: 'flex-end',
    position: 'relative',
    cursor: 'pointer'
  },
  barValue: {
    fontSize: '11px',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: '6px',
    color: 'var(--text-primary)',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    position: 'absolute',
    top: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--glass-border)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
  },
  barFill: {
    width: '100%',
    borderRadius: '6px 6px 0 0',
    background: 'linear-gradient(to top, var(--accent-primary), var(--accent-secondary))',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)',
    transition: 'all 0.3s ease',
    '&:hover': {
      filter: 'brightness(1.2)'
    }
  },
  // We can hook hover visibility on mouseOver
  barLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '10px',
    fontWeight: '600'
  },
  emptyCardList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: 'var(--text-muted)',
    fontSize: '14px'
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  cardListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px solid var(--glass-border)',
    backgroundColor: 'rgba(0, 0, 0, 0.01)'
  },
  listItemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  listItemName: {
    fontSize: '14px',
    fontWeight: '600'
  },
  listItemSku: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  listItemStats: {
    textAlign: 'right'
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '16px',
    color: 'var(--text-secondary)'
  },
  errorContainer: {
    padding: '32px',
    color: 'var(--color-danger)'
  }
};
