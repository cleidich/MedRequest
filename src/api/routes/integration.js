'use strict';

const { Router } = require('express');
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
 * POST /api/integration/forward-emr — Forward a request to EMR.
 * Body: { requestId }
 */
router.post('/forward-emr', async (req, res, next) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }
    const result = await integrationService.forwardToEmr(req.user.tenantId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/integration/forward-business-office — Forward a request to business office.
 * Body: { requestId }
 */
router.post('/forward-business-office', async (req, res, next) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }
    const result = await integrationService.forwardToBusinessOffice(req.user.tenantId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/integration/notify — Send notification for a request.
 * Body: { requestId, message }
 */
router.post('/notify', async (req, res, next) => {
  try {
    const { requestId, message } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }
    const result = await integrationService.sendNotification(req.user.tenantId, requestId, message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
