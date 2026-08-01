import React from 'react';

export default function Sidebar({ user, activeView, onViewChange, onLogout }) {
  if (!user) return null;

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      roles: ['Admin', 'Warehouse Manager', 'Cashier'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )
    },
    {
      id: 'inventory',
      label: 'Inventory',
      roles: ['Admin', 'Warehouse Manager', 'Cashier'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    },
    {
      id: 'weighing',
      label: 'Weighing Station',
      roles: ['Admin', 'Warehouse Manager', 'Cashier'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      )
    },
    {
      id: 'pos',
      label: 'Checkout & Billing',
      roles: ['Admin', 'Cashier'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      )
    },
    {
      id: 'reports',
      label: 'Reports',
      roles: ['Admin', 'Warehouse Manager'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    },
    {
      id: 'users',
      label: 'Employees',
      roles: ['Admin'],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    }
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <aside style={styles.sidebar} className="glass-panel">
      <div style={styles.brandContainer}>
        <div style={styles.brandLogo}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-primary)'}}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div style={styles.brandName}>
          <span style={styles.brandText}>Gravity</span>Mart
          <div style={styles.brandSubtext}>Warehouse & Billing</div>
        </div>
      </div>

      <div style={styles.userSection}>
        <div style={styles.avatar}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div style={styles.userInfo}>
          <div style={styles.username}>{user.username}</div>
          <div style={styles.roleBadge} className={`badge badge-info`}>
            {user.role}
          </div>
        </div>
      </div>

      <nav style={styles.nav}>
        {filteredMenu.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              style={{
                ...styles.navLink,
                backgroundColor: isActive ? 'var(--accent-glow)' : 'transparent',
                borderColor: isActive ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              className="nav-item-btn"
            >
              <span style={{
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                display: 'inline-flex'
              }}>
                {item.icon}
              </span>
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <button onClick={onLogout} style={styles.logoutBtn} className="btn btn-danger w-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    height: '100vh',
    position: 'sticky',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    borderRight: '1px solid var(--glass-border)',
    borderRadius: 0,
    backgroundColor: 'var(--bg-secondary)',
    zIndex: 900
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px'
  },
  brandLogo: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(99, 102, 241, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandName: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.2'
  },
  brandText: {
    color: 'var(--accent-primary)'
  },
  brandSubtext: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    border: '1px solid var(--glass-border)',
    marginBottom: '28px'
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    boxShadow: 'var(--shadow-sm)'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden'
  },
  username: {
    fontSize: '15px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    color: 'var(--text-primary)'
  },
  roleBadge: {
    fontSize: '10px',
    padding: '2px 8px',
    alignSelf: 'flex-start'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexGrow: 1
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px solid transparent',
    fontSize: '15px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    textDecoration: 'none'
  },
  navLabel: {
    whiteSpace: 'nowrap'
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '20px'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px'
  }
};
