import React, { useState, useEffect } from 'react';

export default function Reports({ token, API_URL, checkAuthFailure }) {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' or 'ledger'
  const [salesHistory, setSalesHistory] = useState([]);
  const [ledgerLogs, setLedgerLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Receipt Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'sales') {
        const url = new URL(`${API_URL}/api/reports/daily-sales`);
        if (startDate) url.searchParams.append('startDate', startDate);
        if (endDate) url.searchParams.append('endDate', endDate);

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          checkAuthFailure(res.status);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch sales history logs.');
        const data = await res.json();
        setSalesHistory(data);
      } else {
        const res = await fetch(`${API_URL}/api/reports/inventory-movement`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          checkAuthFailure(res.status);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch stock movement logs.');
        const data = await res.json();
        setLedgerLogs(data);
      }
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInvoice = async (saleId) => {
    setSelectedInvoice(saleId);
    try {
      const res = await fetch(`${API_URL}/api/sales/invoice/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setInvoiceDetails(data);
      }
    } catch (err) {
      checkAuthFailure(err);
      console.error(err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const totalSalesRevenue = salesHistory.reduce((sum, s) => sum + s.total_amount, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Warehouse Reports & Audits</h1>
          <p style={styles.subtitle}>Audit checkout receipts, review history logs, and evaluate item movement trails.</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={styles.tabsRow}>
        <button
          onClick={() => { setActiveTab('sales'); setStartDate(''); setEndDate(''); }}
          style={{
            ...styles.tabBtn,
            color: activeTab === 'sales' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottomColor: activeTab === 'sales' ? 'var(--accent-primary)' : 'transparent'
          }}
        >
          Daily Sales Invoices
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            ...styles.tabBtn,
            color: activeTab === 'ledger' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottomColor: activeTab === 'ledger' ? 'var(--accent-primary)' : 'transparent'
          }}
        >
          Inventory Ledger (All Movements)
        </button>
      </div>

      {/* Date Filters (Sales Tab only) */}
      {activeTab === 'sales' && (
        <div className="glass-panel" style={styles.filterPanel}>
          <div style={styles.filterGrid}>
            <div>
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div style={styles.statsSummary}>
              <div style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Total Invoiced Revenue</div>
              <div style={{fontSize: '22px', fontWeight: '800', color: 'var(--color-success)', marginTop: '2px'}}>
                {formatCurrency(totalSalesRevenue)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tables */}
      {loading ? (
        <div style={{textAlign: 'center', padding: '50px'}}>Fetching report data...</div>
      ) : error ? (
        <div style={{color: 'var(--color-danger)', padding: '20px'}}>Error: {error}</div>
      ) : activeTab === 'sales' ? (
        salesHistory.length === 0 ? (
          <div className="glass-panel" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
            No invoices recorded for the selected date range.
          </div>
        ) : (
          <div className="table-container glass-panel">
            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Cashier Operator</th>
                  <th>Date & Time</th>
                  <th>Payment Type</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Tax (5%)</th>
                  <th className="text-right">Net Amount</th>
                  <th style={{textAlign: 'center'}}>Details</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <code style={{color: 'var(--accent-primary)', fontWeight: '700'}}>{s.invoice_number}</code>
                    </td>
                    <td>{s.cashier_name}</td>
                    <td>{new Date(s.created_at + 'Z').toLocaleString()}</td>
                    <td>{s.payment_method}</td>
                    <td className="text-right">₹{s.subtotal.toFixed(2)}</td>
                    <td className="text-right" style={{color: s.discount > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}}>
                      {s.discount > 0 ? `-₹${s.discount.toFixed(2)}` : '₹0.00'}
                    </td>
                    <td className="text-right">₹{s.tax.toFixed(2)}</td>
                    <td className="text-right" style={{fontWeight: '700', color: 'var(--color-success)'}}>
                      {formatCurrency(s.total_amount)}
                    </td>
                    <td style={{textAlign: 'center'}}>
                      <button onClick={() => handleOpenInvoice(s.id)} className="btn btn-secondary" style={{padding: '4px 10px', fontSize: '12px'}}>
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : ledgerLogs.length === 0 ? (
        <div className="glass-panel" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
          No stock adjustments logged in database yet.
        </div>
      ) : (
        <div className="table-container glass-panel">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Product Description</th>
                <th>SKU</th>
                <th>Transaction</th>
                <th>Quantity</th>
                <th className="text-right">Stock Adjusted</th>
                <th>operator</th>
                <th>Reference Notes</th>
              </tr>
            </thead>
            <tbody>
              {ledgerLogs.map((log) => {
                const isAddition = log.quantity > 0;
                return (
                  <tr key={log.id}>
                    <td style={{fontSize: '13px'}}>{new Date(log.created_at + 'Z').toLocaleString()}</td>
                    <td style={{fontWeight: '700'}}>{log.product_name}</td>
                    <td><code style={{fontSize: '12px'}}>{log.product_sku}</code></td>
                    <td>
                      <span className={`badge ${log.transaction_type === 'restock' ? 'badge-success' : log.transaction_type === 'sale' ? 'badge-info' : 'badge-warning'}`}>
                        {log.transaction_type}
                      </span>
                    </td>
                    <td style={{fontWeight: '700', color: isAddition ? 'var(--color-success)' : 'var(--color-danger)'}}>
                      {isAddition ? '+' : ''}{log.quantity} {log.unit}
                    </td>
                    <td className="text-right" style={{fontSize: '13px'}}>
                      {log.previous_stock} &rarr; <strong>{log.new_stock}</strong>
                    </td>
                    <td>{log.employee_name}</td>
                    <td style={{fontSize: '13px', color: 'var(--text-secondary)'}}>{log.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice receipt modal popup */}
      {selectedInvoice && invoiceDetails && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{maxWidth: '460px', padding: '24px'}}>
            <div style={styles.receiptContainer} id="receipt-print-area">
              <div style={{textAlign: 'center'}}>
                <h2 style={{fontSize: '22px', fontWeight: '800'}}>GRAVITY MART</h2>
                <p style={{fontSize: '12px', color: 'var(--text-secondary)'}}>123 Main Warehouse Boulevard, Sector 7</p>
                <p style={{fontSize: '12px', color: 'var(--text-secondary)'}}>Tel: (555) 019-2834</p>
                <div style={{margin: '16px 0', borderBottom: '1px dashed #ccc'}}></div>
              </div>

              <div style={{fontSize: '11px', lineHeight: '1.5', color: '#000'}}>
                <div><strong>Invoice:</strong> {invoiceDetails.sale.invoice_number}</div>
                <div><strong>Cashier:</strong> {invoiceDetails.sale.cashier_name} ({invoiceDetails.sale.cashier_email})</div>
                <div><strong>Date:</strong> {new Date(invoiceDetails.sale.created_at + 'Z').toLocaleString()}</div>
                <div><strong>Payment:</strong> {invoiceDetails.sale.payment_method}</div>
                <div style={{margin: '16px 0', borderBottom: '1px dashed #ccc'}}></div>
              </div>

              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#000'}}>
                <thead>
                  <tr style={{borderBottom: '1px dashed #ccc'}}>
                    <th style={{textAlign: 'left', padding: '4px', color: '#000'}}>Item</th>
                    <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Qty</th>
                    <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Rate</th>
                    <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceDetails.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{padding: '6px 4px'}}>
                        <div>{item.name}</div>
                        <div style={{fontSize: '9px', color: '#666'}}>{item.sku}</div>
                      </td>
                      <td style={{textAlign: 'right', padding: '6px 4px'}}>{item.quantity} {item.unit}</td>
                      <td style={{textAlign: 'right', padding: '6px 4px'}}>₹{item.price.toFixed(2)}</td>
                      <td style={{textAlign: 'right', padding: '6px 4px', fontWeight: '600'}}>₹{item.total_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{margin: '16px 0', borderBottom: '1px dashed #ccc'}}></div>

              <div style={{fontSize: '11px', color: '#000'}}>
                <div style={{display: 'flex', justifyBetween: 'space-between', justifyContent: 'space-between', margin: '4px 0'}}>
                  <span>Subtotal:</span>
                  <span>₹{invoiceDetails.sale.subtotal.toFixed(2)}</span>
                </div>
                {invoiceDetails.sale.discount > 0 && (
                  <div style={{display: 'flex', justifyContent: 'space-between', margin: '4px 0'}}>
                    <span>Discount:</span>
                    <span>-₹{invoiceDetails.sale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{display: 'flex', justifyContent: 'space-between', margin: '4px 0'}}>
                  <span>Vat/Gst Tax (5%):</span>
                  <span>₹{invoiceDetails.sale.tax.toFixed(2)}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', marginTop: '6px'}}>
                  <span>Total Paid:</span>
                  <span>₹{invoiceDetails.sale.total_amount.toFixed(2)}</span>
                </div>
              </div>

              <div style={{margin: '20px 0 10px 0', borderBottom: '1px dashed #ccc'}}></div>

              <div style={{textAlign: 'center', color: '#000'}}>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  <div style={{height: '35px', width: '180px', background: 'linear-gradient(to right, #000 0%, #000 5%, transparent 5%, transparent 8%, #000 8%, #000 12%, transparent 12%, transparent 18%, #000 18%, #000 20%, transparent 20%, transparent 28%, #000 28%, #000 35%, transparent 35%, transparent 40%, #000 40%, #000 45%, transparent 45%, transparent 52%, #000 52%, #000 58%, transparent 58%, transparent 60%, #000 60%, #000 70%, transparent 70%, transparent 75%, #000 75%, #000 82%, transparent 82%, transparent 88%, #000 88%, #000 95%, transparent 95%, transparent 100%)'}}></div>
                  <div style={{fontSize: '9px', fontFamily: 'monospace', marginTop: '4px'}}>{invoiceDetails.sale.invoice_number}</div>
                </div>
                <p style={{fontSize: '11px', marginTop: '12px', fontWeight: '500'}}>Thank you for your hard work!</p>
                <p style={{fontSize: '9px', color: '#666', marginTop: '2px'}}>Employee Internal Transaction Log</p>
              </div>
            </div>

            <div style={{display: 'flex', gap: '12px', marginTop: '24px'}}>
              <button onClick={() => { setSelectedInvoice(null); setInvoiceDetails(null); }} className="btn btn-secondary w-full">
                Close Invoice
              </button>
              <button onClick={() => window.print()} className="btn btn-primary w-full">
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
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
  tabsRow: {
    display: 'flex',
    gap: '24px',
    borderBottom: '1px solid var(--glass-border)',
    marginBottom: '24px',
    paddingBottom: '2px'
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '12px 6px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  },
  filterPanel: {
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: 'var(--bg-secondary)'
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 2fr',
    gap: '20px',
    alignItems: 'end'
  },
  statsSummary: {
    textAlign: 'right'
  },
  receiptContainer: {
    backgroundColor: '#fff',
    color: '#000',
    padding: '24px',
    borderRadius: '4px',
    fontFamily: 'monospace'
  }
};
