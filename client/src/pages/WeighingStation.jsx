import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function WeighingStation({ token, API_URL, checkAuthFailure }) {
  const [looseProducts, setLooseProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [weight, setWeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [qrResult, setQrResult] = useState(null); // { qrPayload, qrDataUrl }
  const [sessionLog, setSessionLog] = useState([]);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    fetchLooseProducts();
  }, []);

  const fetchLooseProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch products.');
      const data = await res.json();
      const loose = data.filter(p => p.weight_or_count_type === 'loose');
      setLooseProducts(loose);
      if (loose.length > 0) setSelectedProductId(loose[0].id.toString());
      setLoading(false);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
      setLoading(false);
    }
  };

  const selectedProduct = looseProducts.find(p => p.id === parseInt(selectedProductId));

  const totalPrice = selectedProduct ? parseFloat((selectedProduct.price * weight).toFixed(2)) : 0;

  const handleGenerateQR = async () => {
    if (!selectedProduct) return;
    if (weight <= 0) {
      setError('Please set a weight greater than 0.');
      return;
    }
    if (weight > selectedProduct.stock) {
      setError(`Insufficient stock. Available: ${selectedProduct.stock} ${selectedProduct.unit}`);
      return;
    }

    setError('');
    setGenerating(true);

    try {
      const res = await fetch(`${API_URL}/api/weighing/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          weight: weight
        })
      });

      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate QR.');

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(data.qrPayload), {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const result = { qrPayload: data.qrPayload, qrDataUrl, txnId: data.txnId };
      setQrResult(result);
      setSessionLog(prev => [result, ...prev]);
      setWeight(0);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintLabel = () => {
    if (!qrResult) return;
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    const p = qrResult.qrPayload;
    printWindow.document.write(`
      <html>
        <head><title>Weight Label — ${p.name}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; text-align: center; }
          .label { border: 2px solid #000; padding: 16px; max-width: 300px; margin: 0 auto; }
          h2 { margin: 0 0 8px 0; font-size: 18px; }
          .detail { font-size: 13px; margin: 4px 0; }
          .price { font-size: 22px; font-weight: 800; margin: 12px 0; }
          img { margin: 12px 0; }
          .txn { font-size: 10px; color: #666; font-family: monospace; }
        </style>
        </head>
        <body>
          <div class="label">
            <h2>${p.name}</h2>
            <div class="detail"><strong>Weight:</strong> ${p.weight} ${p.unit}</div>
            <div class="detail"><strong>Rate:</strong> ₹${p.pricePerUnit.toFixed(2)} / ${p.unit}</div>
            <div class="price">₹${p.totalPrice.toFixed(2)}</div>
            <img src="${qrResult.qrDataUrl}" width="160" height="160" />
            <div class="txn">${p.txnId}</div>
            <div class="detail" style="font-size:10px; color:#888;">${new Date(p.timestamp).toLocaleString()}</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRandomWeight = () => {
    if (!selectedProduct) return;
    const maxW = Math.min(selectedProduct.stock, 10);
    const randW = parseFloat((Math.random() * maxW + 0.1).toFixed(3));
    setWeight(randW);
  };

  if (loading) {
    return <div style={styles.loadingContainer}>Loading weighing station...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Weighing Station</h1>
          <p style={styles.subtitle}>Weigh loose products and generate QR code labels for checkout scanning.</p>
        </div>
      </div>

      {error && (
        <div className="status-banner warning" style={{marginBottom: '20px'}}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{flexGrow: 1}}>{error}</span>
          <button onClick={() => setError('')} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-warning)', fontWeight: 700, fontSize: '16px'}}>×</button>
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* Left: Scale Simulator */}
        <div className="glass-panel" style={styles.scalePanel}>
          <h3 style={styles.panelTitle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
            Digital Scale
          </h3>

          {/* Product Selector */}
          <div style={styles.formGroup}>
            <label>Select Loose Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => { setSelectedProductId(e.target.value); setWeight(0); setQrResult(null); setError(''); }}
            >
              {looseProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price.toFixed(2)}/{p.unit} (Stock: {p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <>
              {/* Scale Display */}
              <div style={styles.scaleDisplay}>
                <div style={styles.scaleValue}>
                  <span style={styles.scaleNumber}>{weight.toFixed(3)}</span>
                  <span style={styles.scaleUnit}>{selectedProduct.unit}</span>
                </div>
                <div style={styles.scaleMeta}>
                  <span>Rate: ₹{selectedProduct.price.toFixed(2)} / {selectedProduct.unit}</span>
                  <span style={styles.scaleTotalPrice}>Total: ₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Weight Slider */}
              <div style={styles.sliderSection}>
                <label style={{fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)'}}>
                  Adjust Weight ({selectedProduct.unit})
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.min(selectedProduct.stock, 50)}
                  step="0.001"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value))}
                  style={styles.slider}
                />
                <div style={styles.weightInputRow}>
                  <input
                    type="number"
                    min="0"
                    max={selectedProduct.stock}
                    step="0.001"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    style={styles.weightNumericInput}
                  />
                  <button onClick={handleRandomWeight} className="btn btn-secondary" style={{padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap'}}>
                    Random Fill
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateQR}
                disabled={generating || weight <= 0}
                className="btn btn-primary w-full"
                style={{marginTop: '20px', padding: '14px', fontSize: '16px', fontWeight: 700}}
              >
                {generating ? 'Generating...' : '⚖️ Weigh & Generate QR Label'}
              </button>
            </>
          )}

          {looseProducts.length === 0 && (
            <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
              No loose products found in inventory. Add loose products (rice, grains, vegetables, etc.) in the Inventory page.
            </div>
          )}
        </div>

        {/* Right: QR Result + Log */}
        <div style={styles.rightColumn}>
          {/* QR Code Result Card */}
          {qrResult ? (
            <div className="glass-panel" style={styles.qrResultCard}>
              <h3 style={styles.panelTitle}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                Generated QR Label
              </h3>

              <div style={styles.qrLabelPreview}>
                <div style={styles.qrLabelCard}>
                  <h4 style={{margin: '0 0 8px', fontSize: '16px', fontWeight: 700}}>{qrResult.qrPayload.name}</h4>
                  <div style={styles.qrLabelDetail}>
                    <span>Weight</span>
                    <strong>{qrResult.qrPayload.weight} {qrResult.qrPayload.unit}</strong>
                  </div>
                  <div style={styles.qrLabelDetail}>
                    <span>Rate</span>
                    <strong>₹{qrResult.qrPayload.pricePerUnit.toFixed(2)} / {qrResult.qrPayload.unit}</strong>
                  </div>
                  <div style={{...styles.qrLabelDetail, fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)', borderTop: '1px solid var(--glass-border)', paddingTop: '8px'}}>
                    <span>Total</span>
                    <strong>₹{qrResult.qrPayload.totalPrice.toFixed(2)}</strong>
                  </div>
                  <img src={qrResult.qrDataUrl} alt="QR Code" style={styles.qrImage} />
                  <div style={{fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace'}}>{qrResult.txnId}</div>
                  <div style={{fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px'}}>
                    {new Date(qrResult.qrPayload.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <button onClick={handlePrintLabel} className="btn btn-primary w-full" style={{marginTop: '16px', gap: '8px'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print Label Sticker
              </button>
            </div>
          ) : (
            <div className="glass-panel" style={{...styles.qrResultCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '300px'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: '12px', opacity: 0.4}}>
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              <p style={{fontSize: '14px'}}>Select a product, set the weight, and generate a QR code label.</p>
            </div>
          )}

          {/* Session Log */}
          <div className="glass-panel" style={styles.sessionLogPanel}>
            <h3 style={styles.panelTitle}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Session Log ({sessionLog.length})
            </h3>
            {sessionLog.length === 0 ? (
              <div style={{textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px'}}>
                No items weighed yet in this session.
              </div>
            ) : (
              <div style={styles.logList}>
                {sessionLog.map((item, idx) => (
                  <div key={idx} style={styles.logItem}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <div style={{fontWeight: 600, fontSize: '13px'}}>{item.qrPayload.name}</div>
                        <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>{item.qrPayload.weight} {item.qrPayload.unit} — {item.txnId}</div>
                      </div>
                      <div style={{fontWeight: 700, color: 'var(--accent-primary)', fontSize: '14px'}}>₹{item.qrPayload.totalPrice.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    alignItems: 'start'
  },
  scalePanel: {
    padding: '28px',
    backgroundColor: 'var(--bg-secondary)'
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '20px',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '20px'
  },
  scaleDisplay: {
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    borderRadius: 'var(--border-radius-md)',
    padding: '28px',
    textAlign: 'center',
    marginBottom: '24px',
    boxShadow: 'var(--shadow-md)'
  },
  scaleValue: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '8px'
  },
  scaleNumber: {
    fontSize: '56px',
    fontWeight: '800',
    color: '#fff',
    fontFamily: "'Outfit', sans-serif",
    lineHeight: '1'
  },
  scaleUnit: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)'
  },
  scaleMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '16px',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500'
  },
  scaleTotalPrice: {
    fontWeight: '700',
    fontSize: '16px',
    color: '#fff'
  },
  sliderSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    accentColor: 'var(--accent-primary)'
  },
  weightInputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  weightNumericInput: {
    flexGrow: 1,
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: '700',
    padding: '10px'
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  qrResultCard: {
    padding: '28px',
    backgroundColor: 'var(--bg-secondary)'
  },
  qrLabelPreview: {
    display: 'flex',
    justifyContent: 'center'
  },
  qrLabelCard: {
    textAlign: 'center',
    padding: '20px',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'rgba(0,0,0,0.01)',
    maxWidth: '280px',
    width: '100%'
  },
  qrLabelDetail: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    margin: '6px 0',
    color: 'var(--text-secondary)'
  },
  qrImage: {
    margin: '16px auto',
    display: 'block',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  sessionLogPanel: {
    padding: '24px',
    backgroundColor: 'var(--bg-secondary)'
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto'
  },
  logItem: {
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px solid var(--glass-border)',
    backgroundColor: 'rgba(0,0,0,0.01)'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '16px',
    color: 'var(--text-secondary)'
  }
};
