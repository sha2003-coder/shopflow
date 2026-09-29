const express = require('express');
const cors = require('cors');
const config = require('./config/environment');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

const app = express();

// Enable CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Mount API routes under /api
app.use('/api', routes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// Production PORT & host binding (0.0.0.0 required for container/cloud platforms like Render)
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Start Express server
const server = app.listen(PORT, HOST, () => {
  console.log(`[Server] ShopFlow API running on port ${PORT} bound to ${HOST} in ${config.nodeEnv} mode`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server };
