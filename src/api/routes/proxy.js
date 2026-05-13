'use strict';

const express = require('express');
const router = express.Router();

const APIM_GATEWAY_URL = process.env.APIM_GATEWAY_URL;
const APIM_SUBSCRIPTION_KEY = process.env.APIM_SUBSCRIPTION_KEY;

/**
 * APIM server-side proxy route.
 * 
 * Proxies requests through APIM gateway server-side to eliminate CORS issues.
 * Browser calls same-origin /api/proxy/*, Express forwards to APIM.
 * 
 * Example: GET /api/proxy/requests → forwards to APIM_GATEWAY_URL/requests
 */
router.all('/*', async (req, res) => {
  // Check APIM configuration
  if (!APIM_GATEWAY_URL || !APIM_SUBSCRIPTION_KEY) {
    return res.status(503).json({ error: 'APIM proxy not configured' });
  }

  try {
    // Strip /api/proxy prefix, keep the rest
    // req.params[0] contains everything after /api/proxy/
    const targetPath = req.params[0] || '';
    const targetUrl = `${APIM_GATEWAY_URL}/api/${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    // Forward auth headers from the original request
    const headers = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': APIM_SUBSCRIPTION_KEY,
    };

    // Pass through auth headers if present
    if (req.headers['x-tenant-id']) {
      headers['X-Tenant-Id'] = req.headers['x-tenant-id'];
    }
    if (req.headers['x-user-id']) {
      headers['X-User-Id'] = req.headers['x-user-id'];
    }
    if (req.headers['x-user-role']) {
      headers['X-User-Role'] = req.headers['x-user-role'];
    }

    // Build fetch options
    const fetchOptions = {
      method: req.method,
      headers,
    };

    // Include body for POST, PATCH, PUT, DELETE
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Forward request to APIM
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    
    // Parse response based on content type
    let responseBody;
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    // Return APIM response with same status code
    if (typeof responseBody === 'string') {
      res.status(response.status).send(responseBody);
    } else {
      res.status(response.status).json(responseBody);
    }

  } catch (error) {
    console.error('[APIM Proxy] Error forwarding request:', error);
    return res.status(502).json({ error: 'APIM gateway unreachable' });
  }
});

module.exports = router;
