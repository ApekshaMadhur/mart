import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import WeighingStation from './pages/WeighingStation';
import Reports from './pages/Reports';
import Users from './pages/Users';

// Dynamically target backend port 5000 when running client on Vite 5173 or other dev ports
const API_URL = "https://mart-juh9.onrender.com";

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gravity_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('gravity_token') || null;
  });

  const [view, setView] = useState('dashboard');

  const handleLoginSuccess = (loggedInUser, userToken) => {
    setUser(loggedInUser);
    setToken(userToken);
    localStorage.setItem('gravity_user', JSON.stringify(loggedInUser));
    localStorage.setItem('gravity_token', userToken);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('gravity_user');
    localStorage.removeItem('gravity_token');
  };

  // Global HTTP intercept helper for authentication state check
  const checkAuthFailure = (errOrStatus) => {
    const status = errOrStatus?.status || (typeof errOrStatus === 'number' ? errOrStatus : null);
    if (status === 401 || status === 403) {
      handleLogout();
      return true;
    }
    if (errOrStatus instanceof Error) {
      const msg = errOrStatus.message;
      if (msg.includes('401') || msg.includes('403')) {
        handleLogout();
        return true;
      }
    }
    return false;
  };

  if (!user || !token) {
    return <Login onLoginSuccess={handleLoginSuccess} API_URL={API_URL} />;
  }

  // Render sub-page views
  const renderActiveView = () => {
    const commonProps = { token, API_URL, checkAuthFailure };
    switch (view) {
      case 'dashboard':
        return <Dashboard {...commonProps} onViewChange={setView} />;
      case 'inventory':
        return <Inventory {...commonProps} user={user} />;
      case 'weighing':
        return <WeighingStation {...commonProps} />;
      case 'pos':
        return <POS {...commonProps} user={user} />;
      case 'reports':
        return <Reports {...commonProps} />;
      case 'users':
        return <Users {...commonProps} user={user} />;
      default:
        return <Dashboard {...commonProps} onViewChange={setView} />;
    }
  };

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar
        user={user}
        activeView={view}
        onViewChange={setView}
        onLogout={handleLogout}
      />

      {/* Main Workspace Frame */}
      <main style={styles.mainContent}>
        {/* Top Header Bar */}
        <header style={styles.headerBar} className="glass-panel">
          <div style={styles.headerTitle}>
            <span style={{color: 'var(--text-muted)'}}>Current View &rarr;</span>
            <span style={styles.viewName}>{view.charAt(0).toUpperCase() + view.slice(1)}</span>
          </div>
          <div style={styles.headerUser}>
            <span style={styles.statusDot}></span>
            <span style={{fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)'}}>
              Logged in as: <strong>{user.username}</strong> ({user.role})
            </span>
          </div>
        </header>

        {/* View Content area */}
        <div style={styles.viewWrapper}>
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
}

const styles = {
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowY: 'auto',
    position: 'relative'
  },
  headerBar: {
    height: '70px',
    borderRadius: 0,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    backgroundColor: 'var(--bg-secondary)',
    position: 'sticky',
    top: 0,
    zIndex: 800
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: '500'
  },
  viewName: {
    fontWeight: '700',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  headerUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-success)',
    boxShadow: '0 0 6px var(--color-success)'
  },
  viewWrapper: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column'
  }
};
