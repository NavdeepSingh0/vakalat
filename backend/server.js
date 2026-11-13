const { config } = require('./config/env');
const logger = require('./services/logger');
const { initFirebase } = require('./config/firebase');
const { CaseStore } = require('./services/caseStore');
const { createFirestorePersistence } = require('./services/firestorePersistence');
const { buildDemoCases } = require('./data/demo-cases');
const { createApp } = require('./app');

const db = initFirebase(config.firebaseServiceAccountPath);
const store = new CaseStore({
    demoCases: buildDemoCases(),
    ttlMs: config.caseCacheTtlMs,
    persistence: db ? createFirestorePersistence(db) : null,
});
store.startSweeper();

const app = createApp({ config, store });
const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv, persistence: db ? 'firestore' : 'memory' }, 'Vakalat API listening');
});

function shutdown(signal) {
    logger.info({ signal }, 'shutting down');
    store.stopSweeper();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
