const axios = require('axios');

const CARBON_SERVICE_URL = process.env.CARBON_SERVICE_URL || 'http://localhost:8001';

/**
 * Creates an axios client configured for the Django Carbon Service
 */
const carbonClient = axios.create({
  baseURL: CARBON_SERVICE_URL,
  timeout: 30000, // ML inference can take a bit
  headers: { 'Content-Type': 'application/json' },
});

/**
 * POST /api/carbon/calculate
 * Proxy to Django: POST /api/carbon/calculate/
 */
exports.calculate = async (req, res, next) => {
  try {
    const { data } = await carbonClient.post('/api/carbon/calculate/', req.body);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.error || 'Carbon Service unavailable';
    res.status(status).json({ success: false, error: message });
  }
};

/**
 * GET /api/carbon/forecast
 * Proxy to Django: GET /api/carbon/forecast/
 */
exports.getForecast = async (req, res, next) => {
  try {
    const { data } = await carbonClient.get('/api/carbon/forecast/', { params: req.query });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.error || 'Carbon Service unavailable';
    res.status(status).json({ success: false, error: message });
  }
};

/**
 * GET /api/carbon/recommendations
 * Proxy to Django: GET /api/carbon/recommendations/
 */
exports.getRecommendations = async (req, res, next) => {
  try {
    const { data } = await carbonClient.get('/api/carbon/recommendations/', { params: req.query });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.error || 'Carbon Service unavailable';
    res.status(status).json({ success: false, error: message });
  }
};

/**
 * POST /api/carbon/score/:supplierId
 * Proxy to Django: POST /api/carbon/score/
 */
exports.scoreSupplier = async (req, res, next) => {
  try {
    const { data } = await carbonClient.post('/api/carbon/score/', {
      supplierId: req.params.supplierId,
      ...req.body,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.response?.status || 502;
    const message = err.response?.data?.error || 'Carbon Service unavailable';
    res.status(status).json({ success: false, error: message });
  }
};
