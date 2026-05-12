'use strict';

const { Router } = require('express');
const router = Router();

// GET /api/config — public frontend configuration (no auth required)
router.get('/', (_req, res) => {
  const gatewayUrl = process.env.APIM_GATEWAY_URL;
  const subscriptionKey = process.env.APIM_SUBSCRIPTION_KEY;

  if (!gatewayUrl) {
    return res.json({ apim: { enabled: false } });
  }

  res.json({
    apim: {
      enabled: true,
      baseUrl: gatewayUrl,
      subscriptionKey: subscriptionKey || '',
    },
  });
});

module.exports = router;
