/**
 * Optional Firestore write-through for live cases and order summaries.
 * Only created when Firebase credentials resolve (see config/firebase.js); otherwise the app is
 * memory-only. Documents carry an `expiresAt` so stale snapshots are ignored on load.
 *
 *   cases/{CNR}                       { data, expiresAt, updatedAt }
 *   cases/{CNR}/orders/{hearingId}    { text?, summary?, updatedAt }
 */
function createFirestorePersistence(db, { now = Date.now } = {}) {
    const caseRef = (cnr) => db.collection('cases').doc(cnr);

    return {
        async saveCase(cnr, data, expiresAt) {
            // Order references are internal and may be large; they are re-created on the next live lookup.
            const safe = { ...data, hearings: (data.hearings || []).map((h) => ({ ...h, orderRef: h.orderRef ? { stored: true } : null })) };
            await caseRef(cnr).set({ data: JSON.parse(JSON.stringify(safe)), expiresAt, updatedAt: new Date(now()).toISOString() });
        },
        async loadCase(cnr) {
            const snap = await caseRef(cnr).get();
            if (!snap.exists) return null;
            const doc = snap.data();
            if (!doc || !doc.data || !(doc.expiresAt > now())) return null;
            return doc.data;
        },
        async saveOrder(cnr, hearingId, patch) {
            await caseRef(cnr).collection('orders').doc(String(hearingId)).set({ ...patch, updatedAt: new Date(now()).toISOString() }, { merge: true });
        },
        async loadOrder(cnr, hearingId) {
            const snap = await caseRef(cnr).collection('orders').doc(String(hearingId)).get();
            return snap.exists ? snap.data() : null;
        },
    };
}

module.exports = { createFirestorePersistence };
