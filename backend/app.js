const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { config: defaultConfig } = require('./config/env');
const logger = require('./services/logger');
const { CaseStore } = require('./services/caseStore');
const { buildDemoCases } = require('./data/demo-cases');
const defaultEcourts = require('./services/ecourts');
const { createGemini } = require('./services/gemini');
const { createOrderService } = require('./services/orderService');
const { createLimiters } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { createCaseRouter } = require('./routes/caseRoutes');
const { createEcourtsRouter } = require('./routes/ecourtsRoutes');
const { createOrderRouter } = require('./routes/orderRoutes');
const translateRoutes = require('./routes/translateRoutes');
const pkg = require('./package.json');

/**
 * Builds the Express app without listening, so tests can mount it on an ephemeral port.
 * Every collaborator can be replaced via `deps` (store, ecourts, gemini, config, persistenceName).
 */
function createApp(deps = {}) {
    const config = deps.config || defaultConfig;
    const store = deps.store || new CaseStore({ demoCases: buildDemoCases(), ttlMs: config.caseCacheTtlMs });
    const ecourts = deps.ecourts || defaultEcourts;
    const gemini = deps.gemini || createGemini(config.gemini);
    const orders = createOrderService({ store, ecourts, gemini });
    const limiters = createLimiters(config);

    const app = express();
    app.disable('x-powered-by');
    if (config.trustProxy) app.set('trust proxy', 1);

    app.use(helmet());
    app.use(cors({
        // Requests with no Origin header (curl, server-to-server, same-origin) are allowed; browsers
        // from any origin that is not on the allow-list get no CORS headers and are blocked.
        origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    }));
    app.use(express.json({ limit: '10kb' }));

    // Access log — logs the route pattern (e.g. /case/:cnr), never the actual CNR.
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            logger.info({
                method: req.method,
                route: req.route ? `${req.baseUrl}${req.route.path}` : '(unmatched)',
                status: res.statusCode,
                ms: Date.now() - start,
            }, 'request');
        });
        next();
    });

    app.get('/', (req, res) => {
        res.json({
            name: 'Vakalat API', version: pkg.version,
            docs: 'See README.md — endpoints below are all under /api',
            endpoints: [
                'GET  /api/health', 'GET  /api/demo-cases', 'GET  /api/cost-config', 'GET  /api/translate?code=',
                'GET  /api/captcha?courtType=district|highcourt', 'POST /api/case/cnr/live',
                'GET  /api/case/:cnr', 'GET  /api/case/:cnr/{hearings,stage,questions,prep,whatsapp,summary}',
                'POST /api/case/:cnr/cost', 'GET  /api/order/:cnr/:hearingId/{download,text,summary,actions}',
            ],
        });
    });

    app.use('/api', limiters.general);

    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            persistence: store.persistence ? 'firestore' : 'memory',
            demoCasesLoaded: store.listDemo().length,
            aiSummaries: gemini.isConfigured() ? 'enabled' : 'sample-only',
            version: pkg.version,
        });
    });

    app.use('/api', translateRoutes);
    app.use('/api', createEcourtsRouter({ store, ecourts, limiter: limiters.ecourts }));
    app.use('/api', createCaseRouter({ store }));
    app.use('/api/order', createOrderRouter({ orders, limiter: limiters.order }));

    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
