import React, { useState, useEffect } from 'react';

export default function Users({ token, user, API_URL, checkAuthFailure }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Forms
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Cashier'
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      if (!res.ok) throw new Error('Failed to retrieve employee list.');
      const data = await res.json();
      setUsers(data);
      setLoading(false);
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setError(err.message);
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'Cashier'
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (u) => {
    setSelectedUser(u);
    setFormData({
      email: u.email,
      password: '',
      role: u.role
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
        method: 'POST',
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

      if (!res.ok) throw new Error(data.error || 'Failed to create user.');

      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role
        })
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to update user.');

      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === user.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete employee '${u.username}'?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        checkAuthFailure(res.status);
        return;
      }
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      fetchUsers();
    } catch (err) {
      if (checkAuthFailure(err)) return;
      alert(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Employee Accounts</h1>
          <p style={styles.subtitle}>Control roles, create logins, and manage staff security settings.</p>
        </div>
        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="16" y1="11" x2="22" y2="11" />
          </svg>
          Add Employee Account
        </button>
      </div>

      {loading ? (
        <div style={{textAlign: 'center', padding: '40px'}}>Loading employee ledger...</div>
      ) : error ? (
        <div style={{color: 'var(--color-danger)', padding: '20px'}}>Error: {error}</div>
      ) : (
        <div className="table-container glass-panel">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Registered Email</th>
                <th>Access Privilege / Role</th>
                <th>Date Added</th>
                <th style={{textAlign: 'center'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{fontWeight: 700}}>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'Admin' ? 'badge-danger' : u.role === 'Warehouse Manager' ? 'badge-warning' : 'badge-info'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.created_at + 'Z').toLocaleDateString()}</td>
                  <td>
                    <div style={styles.actionCell}>
                      <button onClick={() => handleOpenEditModal(u)} className="btn btn-secondary" style={styles.actionBtn}>
                        Edit / Reset
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="btn btn-danger"
                        style={styles.actionBtn}
                        disabled={u.id === user.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{maxWidth: '460px'}}>
            <h3 style={{fontSize: '20px', fontWeight: '700', marginBottom: '20px'}}>Add Employee</h3>

            {formError && (
              <div className="badge-danger" style={{padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label htmlFor="modalUsername">Username</label>
                <input
                  id="modalUsername"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="e.g. johndoe"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="modalEmail">Email Address (for 2FA)</label>
                <input
                  id="modalEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="e.g. john@supermarket.com"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="modalPassword">Password</label>
                <input
                  id="modalPassword"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="modalRole">Role Privilege</label>
                <select
                  id="modalRole"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="Cashier">Cashier</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="mt-lg">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{maxWidth: '460px'}}>
            <h3 style={{fontSize: '20px', fontWeight: '700', marginBottom: '8px'}}>Edit Employee</h3>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px'}}>
              Modifying credentials for <strong>{selectedUser.username}</strong>.
            </p>

            {formError && (
              <div className="badge-danger" style={{padding: '10px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px'}}>
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label htmlFor="editEmail">Email Address (for 2FA)</label>
                <input
                  id="editEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="editPassword">Reset Password (Leave blank to keep current)</label>
                <input
                  id="editPassword"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Enter new password"
                />
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="editRole">Role Privilege</label>
                <select
                  id="editRole"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  disabled={selectedUser.id === user.id} // Cannot change own role
                >
                  <option value="Cashier">Cashier</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px'}} className="mt-lg">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary" disabled={formLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
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
  actionCell: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center'
  },
  actionBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  }
};
