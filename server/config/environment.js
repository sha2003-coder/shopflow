const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Parses the CORS_ORIGIN environment variable.
 * Supports a single origin string or comma-separated list of origins.
 * Defaults to 'http://localhost:5173' for local development.
 */
function parseCorsOrigin(rawOrigin) {
  if (!rawOrigin || !rawOrigin.trim()) {
    return 'http://localhost:5173';
  }
  const trimmed = rawOrigin.trim();
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return trimmed;
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
};

module.exports = config;

