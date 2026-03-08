const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let db;

function initFirebase() {
    if (admin.apps.length > 0) {
        db = admin.firestore();
        return db;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

    try {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        db = admin.firestore();
        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.warn('⚠️  Firebase initialization failed:', error.message);
        console.warn('   Running in DEMO MODE (in-memory storage).');
        db = null;
    }

    return db;
}

function getDb() {
    return db;
}

module.exports = { initFirebase, getDb };
