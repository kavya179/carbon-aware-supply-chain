const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DJANGO_SERVICE_URL = process.env.DJANGO_SERVICE_URL || 'http://127.0.0.1:8000';

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Carbon-Aware Supply Chain Dashboard API Gateway',
    architecture: 'React -> Node.js/Express -> Django REST Framework -> SQLite',
    status: 'online'
  });
});

// Health check endpoint: verifies Node and verifies communication with Django + SQLite
app.get('/api/health', async (req, res) => {
  const nodeStatus = {
    service: 'node_backend',
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database_policy: 'SQLite ONLY (managed exclusively via Django service)'
  };

  let djangoStatus = null;
  let djangoError = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${DJANGO_SERVICE_URL}/api/health/`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      djangoStatus = await response.json();
    } else {
      djangoError = `Django responded with status ${response.status}`;
    }
  } catch (err) {
    djangoError = `Failed to connect to Django service at ${DJANGO_SERVICE_URL}: ${err.message}`;
  }

  const isHealthy = djangoStatus && djangoStatus.status === 'ok';

  return res.status(isHealthy ? 200 : 207).json({
    status: isHealthy ? 'healthy' : 'degraded',
    node: nodeStatus,
    django: djangoStatus || { status: 'unreachable', error: djangoError }
  });
});

// Forward all other /api/* requests directly to Django REST Framework
app.all('/api/*', async (req, res) => {
  try {
    const targetUrl = `${DJANGO_SERVICE_URL}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];
    delete headers.expect;
    delete headers['content-type'];
    delete headers['Content-Type'];

    const fetchOptions = {
      method: req.method,
      headers: {
        ...headers,
        'Accept': 'application/json',
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const djangoRes = await fetch(targetUrl, fetchOptions);
    const contentType = djangoRes.headers.get('content-type');

    res.status(djangoRes.status);
    if (contentType && contentType.includes('application/json')) {
      const data = await djangoRes.json();
      return res.json(data);
    } else {
      const text = await djangoRes.text();
      return res.send(text);
    }
  } catch (err) {
    console.error(`[PROXY ERROR] ${req.method} ${req.originalUrl}:`, err);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: `Failed to forward request to Django: ${err.message}`,
      cause: err.cause ? err.cause.message : null
    });
  }
});


app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Node.js Express API running on port ${PORT}`);
  console.log(`Forwarding to Django service at: ${DJANGO_SERVICE_URL}`);
  console.log(`Database rule: Single SQLite database (via Django)`);
  console.log(`=======================================================`);
});
