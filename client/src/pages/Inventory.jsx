import React, { useState, useEffect } from 'react';

export default function Inventory({ token, user, API_URL, checkAuthFailure }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [lowStock, setLowStock] = useState(false);

  // Modal States
  const [activeModal, setActiveModal] = useState(null); // 'add', 'edit', 'restock', 'history'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productLogs, setProductLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    sku: '',
    category: '',
    price: '',
    unit: 'packet',
    weight_or_count_type: 'fixed',
    stock: '0',
    low_stock_threshold: '10'
  });
  const [restockQty, setRestockQty] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const canEdit = ['Admin', 'Warehouse Manager'].includes(user.role);
  const canDelete = user.role === 'Admin';

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, category, lowStock]);

  const fetchProducts = async () => {
    try {
      const url = new URL(`${API_URL}/api/products`);
      if (search) url.searchParams.append('search', search);
      if (category) url.searchParams.append('category', category);
      if (lowStock) url.searchParams.append('lowStock', 'true');

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch inventory.');
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      checkAuthFailure(err);
      console.error(err);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      barcode: '',
      sku: '',
      category: '',
      price: '',
      unit: 'packet',
      weight_or_count_type: 'fixed',
      stock: '0',
      low_stock_threshold: '10'
    });
    setFormError('');
    setActiveModal('add');
  };

  const handleOpenEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      sku: product.sku,
      category: product.category,
      price: product.price,
      unit: product.unit,
      weight_or_count_type: product.weight_or_count_type,
      low_stock_threshold: product.low_stock_threshold
    });
    setFormError('');
    setActiveModal('edit');
  };

  const handleOpenRestockModal = (product) => {
    setSelectedProduct(product);
    setRestockQty('');
    setRestockNotes('');
    setFormError('');
    setActiveModal('restock');
  };

  const handleOpenHistoryModal = async (product) => {
    setSelectedProduct(product);
    setActiveModal('history');
    setLogsLoading(true);
    setProductLogs([]);
    try {
      const res = await fetch(`${API_URL}/api/reports/inventory-movement?productId=${product.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch history logs.');
      const data = await res.json();
      setProductLogs(data);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = activeModal === 'edit';
    const url = isEdit ? `${API_URL}/api/products/${selectedProduct.id}` : `${API_URL}/api/products`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product details.');
      }

      setActiveModal(null);
      fetchProducts();
      fetchCategories();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/products/restock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: restockQty,
          notes: restockNotes
        })
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to complete restocking.');

      setActiveModal(null);
      fetchProducts();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion rejected.');
      fetchProducts();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      alert(err.message);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div style={styles.container}>
      {/* Header Panel */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Inventory Management</h1>
          <p style={styles.subtitle}>Track product warehouse supplies, adjust pricing, and review stock adjustments.</p>
        </div>
        {canEdit && (
          <button onClick={handleOpenAddModal} className="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add New Product
          </button>
        )}
      </div>

      {/* Search & Filtering Panel */}
      <div className="glass-panel" style={styles.filterPanel}>
        <div style={styles.filterGrid}>
          <div style={styles.searchBox}>
            <label htmlFor="search">Search Products</label>
            <div style={styles.inputWithIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={styles.searchIcon}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Name, SKU, Barcode..."
                style={{paddingLeft: '40px'}}
              />
            </div>
          </div>

          <div>
            <label htmlFor="category">Category Filter</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={styles.checkboxWrapper}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(e) => setLowStock(e.target.checked)}
                style={styles.checkbox}
              />
              Show Low-Stock Only
            </label>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div style={{textAlign: 'center', padding: '40px'}}>Loading database records...</div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{textAlign: 'center', padding: '60px', color: 'var(--text-muted)'}}>
          No items found matching the selected filters.
        </div>
      ) : (
        <div className="table-container glass-panel">
          <table>
            <thead>
              <tr>
                <th>Product Details</th>
                <th>Category</th>
                <th>Barcode / SKU</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock Level</th>
                <th style={{textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.stock <= p.low_stock_threshold;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{fontWeight: 700, fontSize: '15px'}}>{p.name}</div>
                      <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px'}}>
                        Package Type: <span style={{textTransform: 'capitalize'}}>{p.weight_or_count_type}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{p.category}</span>
                    </td>
                    <td>
                      <div style={{fontSize: '13px', fontFamily: 'monospace'}}>{p.barcode}</div>
                      <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px'}}>SKU: {p.sku}</div>
                    </td>
                    <td className="text-right" style={{fontWeight: '600'}}>
                      {formatCurrency(p.price)}
                    </td>
                    <td className="text-right">
                      <div style={{fontWeight: 700, color: isLow ? 'var(--color-danger)' : 'var(--text-primary)'}}>
                        {p.stock} <span style={{fontSize: '12px', fontWeight: '500'}}>{p.unit}</span>
                      </div>
                      <div style={{fontSize: '10px', color: isLow ? 'var(--color-danger)' : 'var(--text-muted)'}}>
                        Threshold: {p.low_stock_threshold}
                      </div>
                    </td>
                    <td>
                      <div style={styles.actionCell}>
                        {canEdit && (
                          <button onClick={() => handleOpenRestockModal(p)} className="btn btn-success" style={styles.actionBtn}>
                            Restock
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => handleOpenEditModal(p)} className="btn btn-secondary" style={styles.actionBtn}>
                            Edit
                          </button>
                        )}
                        <button onClick={() => handleOpenHistoryModal(p)} className="btn btn-secondary" style={styles.actionBtn} title="View Log History">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-danger" style={styles.actionBtn} title="Delete Product">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3 style={{fontSize: '20px', fontWeight: '700', marginBottom: '20px'}}>
              {activeModal === 'add' ? 'Add New Warehouse Product' : 'Edit Product Details'}
            </h3>

            {formError && (
              <div className="badge-danger" style={{padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label>Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Premium White Flour"
                  required
                />
              </div>

              <div className="grid-2">
                <div style={styles.formGroup}>
                  <label>Barcode ID</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    placeholder="Barcode string"
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label>SKU Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value.toUpperCase()})}
                    placeholder="e.g. FLR-WHT-5K"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div style={styles.formGroup}>
                  <label>Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g. Grains, Snacks, Produce"
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="2.99"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div style={styles.formGroup}>
                  <label>Package Type</label>
                  <select
                    value={formData.weight_or_count_type}
                    onChange={(e) => setFormData({...formData, weight_or_count_type: e.target.value})}
                  >
                    <option value="fixed">Fixed-Package (Count-based)</option>
                    <option value="loose">Loose (Weight-based / Volume)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label>Quantity Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    placeholder="e.g. kg, packet, L, pcs"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                {activeModal === 'add' && (
                  <div style={styles.formGroup}>
                    <label>Initial Stock Level</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                )}
                <div style={styles.formGroup}>
                  <label>Low Stock Threshold</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({...formData, low_stock_threshold: e.target.value})}
                    placeholder="10"
                  />
                </div>
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="mt-lg">
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {activeModal === 'restock' && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{maxWidth: '460px'}}>
            <h3 style={{fontSize: '20px', fontWeight: '700', marginBottom: '8px'}}>Restock Product</h3>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px'}}>
              Adding inventory for <strong>{selectedProduct.name}</strong> (SKU: {selectedProduct.sku}).
            </p>

            {formError && (
              <div className="badge-danger" style={{padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleRestockSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label>Current Stock</label>
                <div style={{fontSize: '16px', fontWeight: '700', padding: '10px 0'}}>
                  {selectedProduct.stock} {selectedProduct.unit}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label>Restock Quantity ({selectedProduct.unit})</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder={`Amount in ${selectedProduct.unit}`}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label>Notes / Reason</label>
                <textarea
                  rows="3"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="e.g. Bulk shipment arrival, standard restocking"
                />
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="mt-lg">
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={formLoading}>
                  {formLoading ? 'Completing...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Logs Modal */}
      {activeModal === 'history' && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{maxWidth: '750px'}}>
            <h3 style={{fontSize: '20px', fontWeight: '700', marginBottom: '6px'}}>Stock Movement Logs</h3>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px'}}>
              Complete ledger audit trail for <strong>{selectedProduct.name}</strong>.
            </p>

            {logsLoading ? (
              <div style={{textAlign: 'center', padding: '30px', color: 'var(--text-secondary)'}}>Loading history ledger...</div>
            ) : productLogs.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>No movement history found for this product.</div>
            ) : (
              <div className="table-container" style={{maxHeight: '350px', overflowY: 'auto'}}>
                <table>
                  <thead>
                    <tr>
                      <th>Time & Date</th>
                      <th>Activity</th>
                      <th>Quantity</th>
                      <th className="text-right">Stock Ledger</th>
                      <th>operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productLogs.map((log) => {
                      const isAddition = log.quantity > 0;
                      return (
                        <tr key={log.id}>
                          <td style={{fontSize: '12px'}}>
                            {new Date(log.created_at + 'Z').toLocaleString()}
                          </td>
                          <td>
                            <span className={`badge ${log.transaction_type === 'restock' ? 'badge-success' : log.transaction_type === 'sale' ? 'badge-info' : 'badge-warning'}`}>
                              {log.transaction_type}
                            </span>
                            <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px'}}>{log.notes}</div>
                          </td>
                          <td style={{fontWeight: '600', color: isAddition ? 'var(--color-success)' : 'var(--color-danger)'}}>
                            {isAddition ? '+' : ''}{log.quantity} {log.unit}
                          </td>
                          <td className="text-right" style={{fontSize: '13px'}}>
                            {log.previous_stock} &rarr; <strong>{log.new_stock}</strong>
                          </td>
                          <td>{log.employee_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'flex-end'}} className="mt-lg">
              <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary">
                Close Logs
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
  filterPanel: {
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: 'var(--bg-secondary)'
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    gap: '20px',
    alignItems: 'end'
  },
  searchBox: {
    display: 'flex',
    flexDirection: 'column'
  },
  inputWithIcon: {
    position: 'relative',
    width: '100%'
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    pointerEvents: 'none'
  },
  checkboxWrapper: {
    display: 'flex',
    alignItems: 'center',
    height: '46px' // align with inputs
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    userSelect: 'none',
    margin: 0
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  actionCell: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center'
  },
  actionBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  }
};
