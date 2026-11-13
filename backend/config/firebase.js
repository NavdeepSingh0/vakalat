/**
 * Optional Firebase Admin / Firestore. Returns null (memory-only mode) unless a service-account
 * file is configured via FIREBASE_SERVICE_ACCOUNT_PATH and can be loaded.
 */
const path = require('node:path');
const logger = require('../services/logger');

let db = null;

function initFirebase(serviceAccountPath) {
    if (!serviceAccountPath) {
        logger.info('Firebase not configured — running memory-only');
        return null;
    }
    try {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
            const serviceAccount = require(path.resolve(serviceAccountPath));
            if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        db = admin.firestore();
        logger.info('Firestore persistence enabled');
    } catch (err) {
        logger.warn({ err: err.message }, 'Firebase initialisation failed — running memory-only');
        db = null;
    }
    return db;
}

function getDb() { return db; }

module.exports = { initFirebase, getDb };
