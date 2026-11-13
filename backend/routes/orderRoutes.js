const express = require('express');
const { cnrParam, hearingIdParam } = require('../middleware/validate');

/**
 * /api/order/:cnr/:hearingId/{download,text,summary,actions}
 * No query parameters are read: the order reference comes from the server's own case store.
 */
function createOrderRouter({ orders, limiter }) {
    const router = express.Router();
    router.param('cnr', cnrParam);
    router.param('hearingId', hearingIdParam);
    router.use(limiter);

    router.get('/:cnr/:hearingId/download', async (req, res) => {
        const pdf = await orders.getPdf(req.cnr, req.hearingId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="order_${req.hearingId}.pdf"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(pdf);
    });

    router.get('/:cnr/:hearingId/text', async (req, res) => {
        const { text, cached } = await orders.getText(req.cnr, req.hearingId);
        res.json({ success: true, hearingId: req.hearingId, text, cached });
    });

    router.get('/:cnr/:hearingId/summary', async (req, res) => {
        const result = await orders.getSummary(req.cnr, req.hearingId);
        res.json({ success: true, hearingId: req.hearingId, ...result });
    });

    router.get('/:cnr/:hearingId/actions', async (req, res) => {
        const result = await orders.getSummary(req.cnr, req.hearingId);
        res.json({
            success: true, hearingId: req.hearingId, actions: result.actions,
            deadlines: result.deadlines, nextHearingPurpose: result.nextHearingPurpose, cached: result.cached,
        });
    });

    return router;
}

module.exports = { createOrderRouter };
