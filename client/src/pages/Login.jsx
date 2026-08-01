import React, { useState, useEffect } from 'react';

export default function Login({ onLoginSuccess, API_URL }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState(1); // 1 = Login, 2 = 2FA
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [devOtpLoading, setDevOtpLoading] = useState(false);

  // Poll for OTP in development tools if we are on step 2
  useEffect(() => {
    let interval;
    if (step === 2 && email) {
      fetchDevOtp();
      // Poll every 3 seconds to auto-discover OTP for maximum convenience
      interval = setInterval(fetchDevOtp, 3000);
    }
    return () => clearInterval(interval);
  }, [step, email]);

  const fetchDevOtp = async () => {
    if (!email) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/dev/otp?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.code) {
          setDevOtp(data.code);
        } else {
          setDevOtp('Not generated / expired');
        }
      }
    } catch (err) {
      console.error('Failed to fetch dev OTP:', err);
    }
  };

  const handleAutofillOtp = () => {
    if (devOtp && devOtp !== 'Not generated / expired') {
      setOtpCode(devOtp);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      // Transition to 2FA Step
      setEmail(data.email);
      setUsername(data.username);
      setStep(2);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code: otpCode })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      // Success
      setLoading(false);
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setPassword('');
    setOtpCode('');
    setError('');
    setDevOtp('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard} className="glass-panel">
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-primary)'}}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 style={styles.title}>Gravity Mart</h2>
          <p style={styles.subtitle}>Warehouse & Billing Management System</p>
        </div>

        {error && (
          <div style={styles.errorAlert} className="badge-danger">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleLoginSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin, cashier, manager"
                disabled={loading}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-md" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            
            <div style={styles.hintBox}>
              <div style={{fontWeight: 600, marginBottom: '4px'}}>Default Seed Credentials:</div>
              <div>• Admin: <code>admin</code> / <code>admin123</code></div>
              <div>• Manager: <code>manager</code> / <code>manager123</code></div>
              <div>• Cashier: <code>cashier</code> / <code>cashier123</code></div>
            </div>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit} style={styles.form}>
            <div style={styles.otpHeader}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--color-success)', marginBottom: '8px'}}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '4px'}}>Enter Verification Code</h3>
              <p style={{fontSize: '13px', textAlign: 'center'}}>A 6-digit security code has been sent to <strong>{email}</strong>.</p>
            </div>

            <div style={styles.formGroup} className="mt-md">
              <label htmlFor="otpCode" className="text-center w-full">6-Digit OTP Code</label>
              <input
                id="otpCode"
                type="text"
                maxLength="6"
                pattern="\d{6}"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={styles.otpInput}
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <div style={{display: 'flex', gap: '12px'}} className="mt-md">
              <button type="button" onClick={handleReset} className="btn btn-secondary w-full" disabled={loading}>
                Back
              </button>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        )}
      </div>

      {step === 2 && (
        <div style={styles.devToolsCard} className="glass-panel">
          <div style={styles.devToolsHeader}>
            <span style={styles.devIndicator}></span>
            <span style={{fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Developer 2FA Helper</span>
          </div>
          <p style={{fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px'}}>
            Since this is running in a sandbox environment, we intercept and display the generated 2FA OTP for testing:
          </p>
          <div style={styles.otpContainer}>
            <div style={styles.otpLabel}>Active OTP Code:</div>
            <div style={styles.otpValue}>
              {devOtp ? (
                <code style={{fontSize: '16px', fontWeight: '800', color: 'var(--accent-primary)', letterSpacing: '2px'}}>{devOtp}</code>
              ) : (
                <span style={{color: 'var(--text-muted)', fontSize: '13px'}}>Generating...</span>
              )}
            </div>
            <button
              onClick={handleAutofillOtp}
              disabled={!devOtp || devOtp === 'Not generated / expired'}
              style={styles.autofillBtn}
              className="btn btn-secondary"
            >
              Autofill OTP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'radial-gradient(circle at 50% 50%, var(--bg-secondary), var(--bg-primary))'
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--bg-secondary)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px'
  },
  logo: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(99, 102, 241, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
    boxShadow: 'var(--shadow-sm)'
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--text-primary)'
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '4px'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '20px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  otpHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '16px'
  },
  otpInput: {
    textAlign: 'center',
    fontSize: '24px',
    fontWeight: '800',
    letterSpacing: '8px',
    padding: '12px',
    maxWidth: '200px',
    margin: '0 auto'
  },
  hintBox: {
    marginTop: '16px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: '1.5'
  },
  devToolsCard: {
    width: '100%',
    maxWidth: '420px',
    marginTop: '20px',
    padding: '20px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
    border: '1px solid rgba(99, 102, 241, 0.15)'
  },
  devToolsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  devIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-success)',
    boxShadow: '0 0 8px var(--color-success)'
  },
  otpContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px solid var(--glass-border)'
  },
  otpLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  otpValue: {
    flexGrow: 1,
    paddingLeft: '16px'
  },
  autofillBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '6px'
  }
};
