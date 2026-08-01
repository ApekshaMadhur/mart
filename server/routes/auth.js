const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { JWT_SECRET, verifyToken, requireRole } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Helper to generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Mailer configuration (optional SMTP)
async function sendOTPEmail(email, code) {
  console.log('\n==================================================');
  console.log(`[EMAIL SIMULATOR] OTP for ${email} is: ${code}`);
  console.log('==================================================\n');

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"Supermarket Admin" <no-reply@supermarket.com>',
        to: email,
        subject: '2FA Verification Code - Supermarket Management System',
        text: `Your 2FA login verification code is: ${code}. It expires in 5 minutes.`,
        html: `<p>Your 2FA login verification code is: <strong>${code}</strong></p><p>It will expire in 5 minutes.</p>`,
      });
      console.log(`Real OTP email sent to ${email}`);
    } catch (err) {
      console.error('Failed to send real OTP email:', err.message);
    }
  }
}

// 1. Login Endpoint (Initiate 2FA)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const employee = await query.get('SELECT * FROM employees WHERE username = ?', [username.toLowerCase().trim()]);
    if (!employee) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = bcrypt.compareSync(password, employee.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Password is valid. Generate and store OTP.
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiration

    await query.run('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)', [
      employee.email,
      code,
      expiresAt
    ]);

    // Send OTP (Mock / Real)
    await sendOTPEmail(employee.email, code);

    // Return username and email so frontend knows where to direct user
    res.json({
      message: '2FA OTP sent to registered email.',
      email: employee.email,
      username: employee.username
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

// 2. Verify 2FA Endpoint (Complete Login)
router.post('/verify-2fa', async (req, res) => {
  const { username, code } = req.body;

  if (!username || !code) {
    return res.status(400).json({ error: 'Username and OTP code are required.' });
  }

  try {
    const employee = await query.get('SELECT * FROM employees WHERE username = ?', [username.toLowerCase().trim()]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Find the latest valid code for this email
    const otpRecord = await query.get(
      'SELECT * FROM otp_codes WHERE email = ? AND expires_at > datetime("now") ORDER BY id DESC LIMIT 1',
      [employee.email]
    );

    if (!otpRecord || otpRecord.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid or expired 2FA code.' });
    }

    // Clean up OTP codes for this email
    await query.run('DELETE FROM otp_codes WHERE email = ?', [employee.email]);

    // Create JWT
    const token = jwt.sign(
      {
        id: employee.id,
        username: employee.username,
        email: employee.email,
        role: employee.role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: employee.id,
        username: employee.username,
        email: employee.email,
        role: employee.role
      }
    });
  } catch (error) {
    console.error('2FA Verification error:', error);
    res.status(500).json({ error: 'An error occurred during 2FA verification.' });
  }
});

// 3. User Management (CRUD) - Admin Only
// Get all users
router.get('/users', verifyToken, requireRole(['Admin']), async (req, res) => {
  try {
    const users = await query.all('SELECT id, username, email, role, created_at FROM employees ORDER BY role, username');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// Create user
router.post('/users', verifyToken, requireRole(['Admin']), async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!['Admin', 'Warehouse Manager', 'Cashier'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  try {
    // Check if username/email already exists
    const existing = await query.get('SELECT id FROM employees WHERE username = ? OR email = ?', [
      username.toLowerCase().trim(),
      email.toLowerCase().trim()
    ]);

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await query.run(
      'INSERT INTO employees (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username.toLowerCase().trim(), email.toLowerCase().trim(), passwordHash, role]
    );

    res.status(201).json({
      message: 'Employee created successfully.',
      user: {
        id: result.id,
        username,
        email,
        role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// Update user
router.put('/users/:id', verifyToken, requireRole(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { email, password, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required.' });
  }

  if (!['Admin', 'Warehouse Manager', 'Cashier'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  try {
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // If changing password
    if (password && password.trim() !== '') {
      const passwordHash = bcrypt.hashSync(password, 10);
      await query.run(
        'UPDATE employees SET email = ?, role = ?, password_hash = ? WHERE id = ?',
        [email.toLowerCase().trim(), role, passwordHash, id]
      );
    } else {
      await query.run(
        'UPDATE employees SET email = ?, role = ? WHERE id = ?',
        [email.toLowerCase().trim(), role, id]
      );
    }

    res.json({ message: 'Employee updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// Delete user
router.delete('/users/:id', verifyToken, requireRole(['Admin']), async (req, res) => {
  const { id } = req.params;

  // Prevent deleting self
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    const existing = await query.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    await query.run('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: 'Employee deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

// 4. DEV ROUTE: Retrieve OTP for debugging / testing
router.get('/dev/otp', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required.' });
  }

  try {
    const otpRecord = await query.get(
      'SELECT code, expires_at FROM otp_codes WHERE email = ? AND expires_at > datetime("now") ORDER BY id DESC LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (!otpRecord) {
      return res.json({ code: null, expired: true });
    }

    res.json({ code: otpRecord.code, expires_at: otpRecord.expires_at });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve OTP.' });
  }
});

module.exports = router;
