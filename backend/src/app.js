const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const emissionRoutes = require('./routes/emissionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const carbonProxyRoutes = require('./routes/carbonProxyRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const footprintRoutes = require('./routes/footprintRoutes');
const aggregationRoutes = require('./routes/aggregationRoutes');
const hotspotRoutes = require('./routes/hotspotRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  credentials: true, // Required: allow cookies (refresh token)
}));

// Global rate limiter for all /api routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// ─── General Middleware ────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Required: parse httpOnly refresh token cookie

// ─── Health Check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'carbon-supply-chain-backend',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// ─── API Routes ───────────────────────────────────────────────────
// Public auth routes (register, login, refresh, forgot-password)
app.use('/api/auth', authRoutes);

// User management (company_manager only)
app.use('/api/users', userRoutes);

// Protected resource routes (role guards applied inside each router)
app.use('/api/suppliers', supplierRoutes);
app.use('/api/emissions', emissionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/carbon', carbonProxyRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/footprint', footprintRoutes);
app.use('/api/aggregation', aggregationRoutes);
app.use('/api/hotspots', hotspotRoutes);
app.use('/api/recommendations', recommendationRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ [Error]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
