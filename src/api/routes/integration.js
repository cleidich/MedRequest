'use strict';

const { Router } = require('express');
const queries = require('../db/queries');
const integrationService = require('../services/integrationService');

const router = Router();

/**
 * GET /api/integration/requests — Pull API for integration consumers.
 * External systems poll this endpoint to retrieve new/updated requests.
 * Query params: status (default: 'new'), since (ISO 8601 timestamp)
 */
router.get('/requests', async (req, res, next) => {
  try {
    const status = req.query.status || 'new';
    const since  = req.query.since  || null;

    const records = await queries.getRequestsForIntegration(
      req.user.tenantId,
      { status, since }
    );

    res.json({
      count: records.length,
      requests: records,
      query: { status, since },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/integration/forward-emr — Forward a request to EMR (stub).
 * Body: { requestId }
 */
router.post('/forward-emr', async (req, res, next) => {
  try {
    const request = await queries.getRequestById(req.user.tenantId, req.body.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const result = await integrationService.forwardToEmr(request);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/integration/notify — Send notification (stub).
 * Body: { requestId, recipientId, channel }
 */
router.post('/notify', async (req, res, next) => {
  try {
    const result = await integrationService.sendNotification({
      requestId:   req.body.requestId,
      recipientId: req.body.recipientId,
      channel:     req.body.channel,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
