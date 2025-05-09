/**
 * Main server file for Race Control application
 */

const express = require('express');
const path = require('path');
const { db } = require('./db');

// Import route handlers
const racesRoutes = require('./routes/races');
const runnersRoutes = require('./routes/runners');
const resultsRoutes = require('./routes/results');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/races', racesRoutes);
app.use('/api/runners', runnersRoutes);
app.use('/api/results', resultsRoutes);

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('Closing database connection');
  db.close();
  process.exit(0);
});