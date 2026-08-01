require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Initializes DB schemas

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/weighing', require('./routes/weighing'));

// Diagnostic Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: 'sqlite'
  });
});

// Serve frontend client assets if built (Production Mode)
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// For routing support in SPA (React Router fallback)
app.get('*', (req, res, next) => {
  // If it's an API route that wasn't matched, skip to next to return 404
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      // If client build doesn't exist, return status
      res.status(200).send('Supermarket Warehouse Server Online. Frontend assets not compiled.');
    }
  });
});

// 404 handler for unmatched API calls
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Exception:', err);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Supermarket Warehouse Server running on port ${PORT}`);
  console.log(`Dev API status check: http://localhost:${PORT}/api/status`);
  console.log(`=======================================================`);
});
