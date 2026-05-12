'use strict';

const { Router } = require('express');
const requestService = require('../services/requestService');

const router = Router();

/**
 * POST /api/requests — Create a new patient request.
 * Body: { type, subject, body }
 */
router.post('/', async (req, res, next) => {
  try {
    const { type, subject, body } = req.body;
    const record = await requestService.createRequest({
      tenantId:  req.user.tenantId,
      patientId: req.user.userId,
      type,
      subject,
      body,
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/requests — List requests for the current tenant.
 * Query params: status, patientId
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status)    filters.status    = req.query.status;
    if (req.query.patientId) filters.patientId = req.query.patientId;

    const records = await requestService.listRequests(req.user.tenantId, filters);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/requests/:id — Get a single request by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const record = await requestService.getRequest(req.user.tenantId, req.params.id);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/requests/:id — Update request status.
 * Body: { status }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const record = await requestService.updateStatus(
      req.user.tenantId,
      req.params.id,
      req.body.status
    );
    res.json(record);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
