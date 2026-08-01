import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function POS({ token, user, API_URL, checkAuthFailure }) {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [productList, setProductList] = useState([]);

  // Scanner states
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lastScannedInfo, setLastScannedInfo] = useState('');

  // Simulated scan dropdown
  const [simulateSelectId, setSimulateSelectId] = useState('');

  // Transaction Outcomes
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkedOutInvoice, setCheckedOutInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);

  const html5QrcodeRef = useRef(null);
  const scannerContainerRef = useRef('qr-reader-container');

  useEffect(() => {
    fetchAllProducts();
    return () => {
      stopScanner();
    };
  }, []);

  const fetchAllProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { checkAuthFailure(res.status); return; }
      if (res.ok) {
        const data = await res.json();
        setProductList(data);
        if (data.length > 0) setSimulateSelectId(data[0].id.toString());
      }
    } catch (err) { checkAuthFailure(err); }
  };

  // ——— SCANNER LOGIC ———
  const startScanner = async () => {
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      }

      const html5Qrcode = new Html5Qrcode(scannerContainerRef.current);
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        () => {} // ignore errors during scanning
      );

      setScannerActive(true);
    } catch (err) {
      console.error('Scanner start error:', err);
      setLookupError('Camera access denied or not available. Use manual entry instead.');
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      }
    } catch (e) { /* ignore */ }
    setScannerActive(false);
  };

  const handleScanResult = async (decodedText) => {
    // Pause scanner briefly to avoid duplicate scans
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.pause(true);
      }
    } catch (e) {}

    setLookupError('');

    // Try parsing as JSON (weighed item QR)
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.type === 'weighed' && parsed.txnId) {
        await addWeighedItemByTxnId(parsed.txnId);
        resumeScanner();
        return;
      }
    } catch (e) {
      // Not JSON — treat as barcode for pre-packed product
    }

    // Barcode lookup for pre-packed
    await addPrepackedByBarcode(decodedText);
    resumeScanner();
  };

  const resumeScanner = () => {
    setTimeout(() => {
      try {
        if (html5QrcodeRef.current) {
          html5QrcodeRef.current.resume();
        }
      } catch (e) {}
    }, 1500);
  };

  // ——— ADD ITEMS ———
  const addWeighedItemByTxnId = async (txnId) => {
    try {
      // Check if already in cart
      if (cart.find(item => item.weighTxnId === txnId)) {
        setLookupError('This weighed item is already in the cart.');
        return;
      }

      const res = await fetch(`${API_URL}/api/weighing/lookup/${txnId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { checkAuthFailure(res.status); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Weigh record lookup failed.');

      setCart(prev => [...prev, {
        type: 'weighed',
        productId: data.product_id,
        name: data.product_name,
        barcode: data.barcode,
        sku: data.sku,
        weight: data.weight,
        unit: data.unit,
        pricePerUnit: data.price_per_unit,
        totalPrice: data.total_price,
        weighTxnId: data.txn_id,
        quantity: data.weight // for display purposes
      }]);

      setLastScannedInfo(`✅ Weighed: ${data.product_name} — ${data.weight} ${data.unit}`);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setLookupError(err.message);
    }
  };

  const addPrepackedByBarcode = async (code) => {
    try {
      const res = await fetch(`${API_URL}/api/products/scan/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { checkAuthFailure(res.status); return; }

      const product = await res.json();
      if (!res.ok) throw new Error(product.error || 'Product not found.');

      if (product.weight_or_count_type === 'loose') {
        setLookupError(`"${product.name}" is a loose product. Please weigh it at the Weighing Station first.`);
        return;
      }

      // Add to cart or increment quantity
      setCart(prev => {
        const existing = prev.find(item => item.type === 'prepacked' && item.productId === product.id);
        if (existing) {
          const newQty = existing.quantity + 1;
          if (newQty > product.stock) {
            setLookupError(`Stock limit reached for ${product.name}.`);
            return prev;
          }
          return prev.map(item =>
            item.type === 'prepacked' && item.productId === product.id
              ? { ...item, quantity: newQty, totalPrice: parseFloat((product.price * newQty).toFixed(2)) }
              : item
          );
        } else {
          if (product.stock < 1) {
            setLookupError(`Out of stock: ${product.name}`);
            return prev;
          }
          return [...prev, {
            type: 'prepacked',
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            sku: product.sku,
            unit: product.unit,
            pricePerUnit: product.price,
            quantity: 1,
            totalPrice: product.price,
            stock: product.stock,
            weighTxnId: null
          }];
        }
      });

      setLastScannedInfo(`✅ Pre-packed: ${product.name}`);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setLookupError(err.message);
    }
  };

  // Manual entry handler
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');

    // Try as weighed txn ID first
    if (code.startsWith('WGH-')) {
      addWeighedItemByTxnId(code);
    } else {
      // Try as JSON (pasted QR data)
      try {
        const parsed = JSON.parse(code);
        if (parsed.type === 'weighed' && parsed.txnId) {
          addWeighedItemByTxnId(parsed.txnId);
          return;
        }
      } catch (e) {}
      // Barcode
      addPrepackedByBarcode(code);
    }
  };

  // Simulated scan for demo
  const handleSimulatedScan = () => {
    if (!simulateSelectId) return;
    const selected = productList.find(p => p.id === parseInt(simulateSelectId));
    if (selected) {
      if (selected.weight_or_count_type === 'loose') {
        setLookupError(`"${selected.name}" is a loose product. Weigh it at the Weighing Station first.`);
        return;
      }
      addPrepackedByBarcode(selected.barcode);
    }
  };

  // Cart operations
  const updatePrepackedQty = (productId, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) return;
    setCart(prev => prev.map(item => {
      if (item.type === 'prepacked' && item.productId === productId) {
        if (qty > item.stock) {
          setLookupError(`Maximum stock for ${item.name} is ${item.stock}.`);
          return item;
        }
        return { ...item, quantity: qty, totalPrice: parseFloat((item.pricePerUnit * qty).toFixed(2)) };
      }
      return item;
    }));
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const sub = parseFloat(cart.reduce((s, item) => s + item.totalPrice, 0).toFixed(2));
  const disc = parseFloat(discount) || 0;
  const tax = parseFloat((Math.max(0, sub - disc) * 0.05).toFixed(2));
  const total = parseFloat((Math.max(0, sub - disc) + tax).toFixed(2));

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) { alert('Cart is empty.'); return; }
    setCheckoutLoading(true);
    setLookupError('');

    const items = cart.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      weighTxnId: item.weighTxnId || undefined
    }));

    try {
      const res = await fetch(`${API_URL}/api/sales/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items, discount: disc, paymentMethod })
      });
      if (res.status === 401 || res.status === 403) { checkAuthFailure(res.status); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed.');

      fetchInvoiceDetails(data.saleId);
      setCheckedOutInvoice(data);
      setCart([]);
      setDiscount('0');
      fetchAllProducts();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      alert(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const fetchInvoiceDetails = async (saleId) => {
    try {
      const res = await fetch(`${API_URL}/api/sales/invoice/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { checkAuthFailure(res.status); return; }
      if (res.ok) {
        const data = await res.json();
        setInvoiceDetails(data);
      }
    } catch (err) { checkAuthFailure(err); }
  };

  const handlePrintReceipt = () => {
    if (!invoiceDetails) return;
    const sale = invoiceDetails.sale;
    const items = invoiceDetails.items;

    const printWindow = window.open('', '_blank', 'width=400,height=700');
    printWindow.document.write(`
      <html><head><title>Receipt ${sale.invoice_number}</title>
      <style>
        body { font-family: monospace; padding: 20px; font-size: 12px; max-width: 300px; margin: 0 auto; }
        h2 { text-align: center; margin: 0 0 4px 0; }
        .center { text-align: center; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3px 0; text-align: left; }
        .right { text-align: right; }
        .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; }
        .badge-weighed { background: #e0f2fe; color: #0369a1; }
        .badge-prepacked { background: #f0fdf4; color: #15803d; }
      </style></head><body>
      <h2>GravityMart</h2>
      <p class="center" style="font-size:10px;">Smart Supermarket Weighing & Billing</p>
      <div class="line"></div>
      <div style="font-size:11px;">
        <div>Invoice: <strong>${sale.invoice_number}</strong></div>
        <div>Cashier: ${sale.cashier_name}</div>
        <div>Date: ${new Date(sale.created_at + 'Z').toLocaleString()}</div>
        <div>Payment: ${sale.payment_method}</div>
      </div>
      <div class="line"></div>
      <table>
        <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amt</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.name} ${item.weigh_txn_id ? '<span class="badge badge-weighed">W</span>' : ''}</td>
              <td class="right">${item.quantity} ${item.unit}</td>
              <td class="right">₹${item.price.toFixed(2)}</td>
              <td class="right">₹${item.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <div class="total-row"><span>Subtotal:</span><span>₹${sale.subtotal.toFixed(2)}</span></div>
      ${sale.discount > 0 ? `<div class="total-row"><span>Discount:</span><span>-₹${sale.discount.toFixed(2)}</span></div>` : ''}
      <div class="total-row"><span>GST (5%):</span><span>₹${sale.tax.toFixed(2)}</span></div>
      <div class="line"></div>
      <div class="total-row" style="font-size:16px;font-weight:800;"><span>TOTAL:</span><span>₹${sale.total_amount.toFixed(2)}</span></div>
      <div class="line"></div>
      <p class="center" style="font-size:10px;">Thank you for shopping at GravityMart!</p>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  // ——— RENDER ———
  if (checkedOutInvoice && invoiceDetails) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🧾 Transaction Complete</h1>
          <p style={styles.subtitle}>Invoice #{invoiceDetails.sale.invoice_number} — {new Date(invoiceDetails.sale.created_at + 'Z').toLocaleString()}</p>
        </div>

        <div className="glass-panel" style={{padding: '28px', backgroundColor: 'var(--bg-secondary)', maxWidth: '500px', margin: '0 auto'}}>
          {/* Receipt */}
          <div style={styles.receiptContainer}>
            <div style={{textAlign: 'center'}}>
              <h2 style={{margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#000'}}>GravityMart</h2>
              <p style={{fontSize: '10px', color: '#666', margin: 0}}>Smart Supermarket Weighing & Billing</p>
            </div>
            <div style={{margin: '12px 0', borderBottom: '1px dashed #ccc'}}></div>
            <div style={{fontSize: '11px', color: '#000', lineHeight: 1.6}}>
              <div>Invoice: <strong>{invoiceDetails.sale.invoice_number}</strong></div>
              <div>Cashier: {invoiceDetails.sale.cashier_name}</div>
              <div>Date: {new Date(invoiceDetails.sale.created_at + 'Z').toLocaleString()}</div>
              <div>Payment: {invoiceDetails.sale.payment_method}</div>
            </div>
            <div style={{margin: '12px 0', borderBottom: '1px dashed #ccc'}}></div>

            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '11px'}}>
              <thead>
                <tr>
                  <th style={{textAlign: 'left', padding: '4px', color: '#000'}}>Item</th>
                  <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Qty</th>
                  <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Rate</th>
                  <th style={{textAlign: 'right', padding: '4px', color: '#000'}}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {invoiceDetails.items.map(item => (
                  <tr key={item.id}>
                    <td style={{padding: '6px 4px', color: '#000'}}>
                      <div>{item.name}</div>
                      <div style={{fontSize: '9px', color: '#888'}}>
                        {item.weigh_txn_id ? `⚖ ${item.weigh_txn_id}` : item.sku}
                      </div>
                    </td>
                    <td style={{textAlign: 'right', padding: '6px 4px', color: '#000'}}>{item.quantity} {item.unit}</td>
                    <td style={{textAlign: 'right', padding: '6px 4px', color: '#000'}}>₹{item.price.toFixed(2)}</td>
                    <td style={{textAlign: 'right', padding: '6px 4px', fontWeight: 600, color: '#000'}}>₹{item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{margin: '12px 0', borderBottom: '1px dashed #ccc'}}></div>
            <div style={{fontSize: '11px', color: '#000'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', margin: '4px 0'}}><span>Subtotal:</span><span>₹{invoiceDetails.sale.subtotal.toFixed(2)}</span></div>
              {invoiceDetails.sale.discount > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', margin: '4px 0'}}><span>Discount:</span><span>-₹{invoiceDetails.sale.discount.toFixed(2)}</span></div>
              )}
              <div style={{display: 'flex', justifyContent: 'space-between', margin: '4px 0'}}><span>GST (5%):</span><span>₹{invoiceDetails.sale.tax.toFixed(2)}</span></div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, marginTop: '8px'}}><span>Total:</span><span>₹{invoiceDetails.sale.total_amount.toFixed(2)}</span></div>
            </div>
          </div>

          <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
            <button onClick={() => { setCheckedOutInvoice(null); setInvoiceDetails(null); }} className="btn btn-secondary w-full">New Transaction</button>
            <button onClick={handlePrintReceipt} className="btn btn-primary w-full">🖨️ Print Receipt</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Checkout & Billing</h1>
          <p style={styles.subtitle}>Scan QR codes (weighed items) or barcodes (pre-packed items) to build the shopping cart.</p>
        </div>
      </div>

      <div style={styles.posGrid}>
        {/* LEFT: Cart */}
        <div className="glass-panel" style={styles.cartPanel}>
          <div style={styles.cartHeader}>
            <h3 style={{fontSize: '16px', fontWeight: 700}}>
              🛒 Shopping Cart ({cart.length} items)
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="btn btn-danger" style={{padding: '6px 12px', fontSize: '12px'}}>Clear All</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div style={styles.emptyCart}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: '12px', opacity: 0.3}}>
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p>Scan items to add them to the cart.</p>
            </div>
          ) : (
            <div style={styles.cartTableWrapper}>
              <table style={styles.cartTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="text-right">Price</th>
                    <th style={{textAlign: 'center'}}>Qty/Wt</th>
                    <th className="text-right">Total</th>
                    <th style={{textAlign: 'center', width: '40px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{fontWeight: 700}}>{item.name}</div>
                        <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px'}}>
                          {item.type === 'weighed' ? item.weighTxnId : `Barcode: ${item.barcode}`}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${item.type === 'weighed' ? 'badge-info' : 'badge-success'}`} style={{fontSize: '10px'}}>
                          {item.type === 'weighed' ? '⚖ Weighed' : '📦 Pre-packed'}
                        </span>
                      </td>
                      <td className="text-right">₹{item.pricePerUnit.toFixed(2)}/{item.unit}</td>
                      <td style={{textAlign: 'center'}}>
                        {item.type === 'weighed' ? (
                          <span style={{fontWeight: 700}}>{item.weight} {item.unit}</span>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) => updatePrepackedQty(item.productId, e.target.value)}
                            style={{width: '60px', textAlign: 'center', padding: '4px', fontWeight: 700}}
                          />
                        )}
                      </td>
                      <td className="text-right" style={{fontWeight: 700}}>₹{item.totalPrice.toFixed(2)}</td>
                      <td style={{textAlign: 'center'}}>
                        <button onClick={() => removeFromCart(idx)} style={styles.deleteBtn}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: Scanner + Checkout */}
        <div style={styles.sideControls}>
          {/* Scanner Card */}
          <div className="glass-panel" style={styles.controlCard}>
            <h3 style={styles.cardTitle}>
              📷 Scan Items
            </h3>

            {/* Camera Scanner */}
            <div style={{marginBottom: '16px'}}>
              <div id="qr-reader-container" style={{
                width: '100%',
                borderRadius: 'var(--border-radius-sm)',
                overflow: 'hidden',
                display: scannerActive ? 'block' : 'none',
                marginBottom: '12px'
              }}></div>

              <button
                onClick={scannerActive ? stopScanner : startScanner}
                className={`btn ${scannerActive ? 'btn-danger' : 'btn-primary'} w-full`}
                style={{gap: '8px'}}
              >
                {scannerActive ? '⏹ Stop Camera' : '📷 Start Camera Scanner'}
              </button>
            </div>

            {lastScannedInfo && (
              <div style={{padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)', fontSize: '12px', fontWeight: 600, marginBottom: '12px'}}>
                {lastScannedInfo}
              </div>
            )}

            {lookupError && (
              <div style={{padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', fontSize: '12px', fontWeight: 600, marginBottom: '12px'}}>
                {lookupError}
              </div>
            )}

            {/* Manual Entry */}
            <div style={{borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginTop: '4px'}}>
              <label style={{fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block'}}>Manual Entry (Barcode or Weigh ID)</label>
              <form onSubmit={handleManualSubmit} style={{display: 'flex', gap: '8px'}}>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter barcode or WGH-... ID"
                  style={{flexGrow: 1}}
                />
                <button type="submit" className="btn btn-secondary" style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>Add</button>
              </form>
            </div>

            {/* Simulated Scan (Demo) */}
            <div style={{borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginTop: '16px'}}>
              <label style={{fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block'}}>Quick Add Pre-packed (Demo)</label>
              <div style={{display: 'flex', gap: '8px'}}>
                <select value={simulateSelectId} onChange={(e) => setSimulateSelectId(e.target.value)} style={{flexGrow: 1}}>
                  {productList.filter(p => p.weight_or_count_type === 'fixed').map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price.toFixed(2)}) — {p.barcode}</option>
                  ))}
                </select>
                <button onClick={handleSimulatedScan} className="btn btn-success" style={{padding: '10px 14px', whiteSpace: 'nowrap'}}>Add</button>
              </div>
            </div>
          </div>

          {/* Checkout Totals Card */}
          <div className="glass-panel" style={{...styles.controlCard, backgroundColor: 'rgba(99, 102, 241, 0.03)'}}>
            <h3 style={styles.cardTitle}>💰 Invoice Settlement</h3>

            <div style={styles.summaryRow}><span>Subtotal:</span><span style={{fontWeight: 600}}>₹{sub.toFixed(2)}</span></div>

            <div style={styles.formGroup} className="mt-sm">
              <label htmlFor="discount">Apply Discount Amount (₹)</label>
              <input id="discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
            </div>

            <div style={styles.summaryRow}><span>GST (5%):</span><span>₹{tax.toFixed(2)}</span></div>

            <div style={{height: '1px', background: 'var(--glass-border)', margin: '12px 0'}}></div>

            <div style={{...styles.summaryRow, fontSize: '18px', fontWeight: 800, margin: '14px 0'}}>
              <span>Invoice Total:</span>
              <span style={{color: 'var(--accent-primary)'}}>₹{total.toFixed(2)}</span>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="payment">Payment Method</label>
              <select id="payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="UPI">UPI Digital Payment</option>
              </select>
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || cart.length === 0}
              className="btn btn-primary w-full"
              style={{marginTop: '16px', padding: '14px', fontSize: '16px', fontWeight: 700}}
            >
              {checkoutLoading ? 'Processing...' : `✅ Complete Checkout — ₹${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%' },
  header: { marginBottom: '28px' },
  title: { fontSize: '28px', fontWeight: '800' },
  subtitle: { fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' },
  posGrid: { display: 'grid', gridTemplateColumns: '7fr 4fr', gap: '24px' },
  cartPanel: { padding: '28px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', minHeight: '520px' },
  cartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' },
  emptyCart: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--text-muted)', padding: '40px' },
  cartTableWrapper: { flexGrow: 1, overflowY: 'auto', maxHeight: '550px' },
  cartTable: { width: '100%', borderCollapse: 'collapse' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' },
  sideControls: { display: 'flex', flexDirection: 'column', gap: '24px' },
  controlCard: { padding: '24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' },
  cardTitle: { fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' },
  formGroup: { display: 'flex', flexDirection: 'column', width: '100%' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '8px 0', color: 'var(--text-secondary)' },
  receiptContainer: { backgroundColor: '#fff', color: '#000', padding: '24px', borderRadius: '4px', fontFamily: 'monospace', boxShadow: 'var(--shadow-sm)' }
};
