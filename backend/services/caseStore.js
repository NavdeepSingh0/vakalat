/**
 * Case storage.
 *   - demo cases: fixed, in memory, never overwritten by live lookups
 *   - live cases: in memory with a TTL (CASE_CACHE_TTL_MIN), optionally written through to Firestore
 *   - order text / summaries: same TTL
 * A live case takes precedence over a demo case with the same CNR until it expires.
 */
const logger = require('./logger');

class CaseStore {
    /**
     * @param {object} opts
     * @param {Array} opts.demoCases
     * @param {number} opts.ttlMs
     * @param {() => number} [opts.now]
     * @param {object|null} [opts.persistence] { saveCase, loadCase, saveOrder, loadOrder } — all optional async fns
     */
    constructor({ demoCases = [], ttlMs, now = Date.now, persistence = null } = {}) {
        this.ttlMs = ttlMs;
        this.now = now;
        this.persistence = persistence;
        this.demo = new Map(demoCases.map((c) => [c.cnr, c]));
        this.live = new Map(); // cnr → { data, expiresAt }
        this.orders = new Map(); // "cnr:id" → { text?, summary?, expiresAt }
        this.sweeper = null;
    }

    // ── cases ────────────────────────────────────────────────────────────────────────────────────
    async getCase(cnr) {
        const key = String(cnr).toUpperCase();
        const live = this.live.get(key);
        if (live && live.expiresAt > this.now()) return live.data;
        if (live) this.live.delete(key);

        if (this.persistence && this.persistence.loadCase) {
            try {
                const data = await this.persistence.loadCase(key);
                if (data) {
                    this.live.set(key, { data, expiresAt: this.now() + this.ttlMs });
                    return data;
                }
            } catch (err) {
                logger.warn({ err: err.message }, 'persistent case load failed');
            }
        }
        return this.demo.get(key) || null;
    }

    async saveLiveCase(cnr, data) {
        const key = String(cnr).toUpperCase();
        const expiresAt = this.now() + this.ttlMs;
        this.live.set(key, { data, expiresAt });
        if (this.persistence && this.persistence.saveCase) {
            try { await this.persistence.saveCase(key, data, expiresAt); }
            catch (err) { logger.warn({ err: err.message }, 'persistent case save failed'); }
        }
    }

    isDemo(cnr) { return this.demo.has(String(cnr).toUpperCase()); }
    listDemo() { return [...this.demo.values()]; }

    searchDemo(type, query) {
        const q = String(query).toLowerCase();
        const fields = type === 'advocate' ? ['petitionerAdvocate', 'respondentAdvocate'] : ['petitioner', 'respondent', 'title'];
        return this.listDemo().filter((c) => fields.some((f) => String(c[f] || '').toLowerCase().includes(q)));
    }

    // ── order text / summary caches ─────────────────────────────────────────────────────────────
    _orderKey(cnr, id) { return `${String(cnr).toUpperCase()}:${id}`; }

    _getOrderEntry(cnr, id) {
        const k = this._orderKey(cnr, id);
        const e = this.orders.get(k);
        if (!e) return null;
        if (e.expiresAt <= this.now()) { this.orders.delete(k); return null; }
        return e;
    }

    async getOrder(cnr, id) {
        const e = this._getOrderEntry(cnr, id);
        if (e) return e;
        if (this.persistence && this.persistence.loadOrder) {
            try {
                const stored = await this.persistence.loadOrder(String(cnr).toUpperCase(), id);
                if (stored) {
                    const entry = { ...stored, expiresAt: this.now() + this.ttlMs };
                    this.orders.set(this._orderKey(cnr, id), entry);
                    return entry;
                }
            } catch (err) {
                logger.warn({ err: err.message }, 'persistent order load failed');
            }
        }
        return null;
    }

    async patchOrder(cnr, id, patch) {
        const k = this._orderKey(cnr, id);
        const current = this._getOrderEntry(cnr, id) || {};
        const next = { ...current, ...patch, expiresAt: this.now() + this.ttlMs };
        this.orders.set(k, next);
        if (this.persistence && this.persistence.saveOrder) {
            try { await this.persistence.saveOrder(String(cnr).toUpperCase(), id, patch); }
            catch (err) { logger.warn({ err: err.message }, 'persistent order save failed'); }
        }
        return next;
    }

    // ── housekeeping ────────────────────────────────────────────────────────────────────────────
    sweep() {
        const t = this.now();
        for (const [k, v] of this.live) if (v.expiresAt <= t) this.live.delete(k);
        for (const [k, v] of this.orders) if (v.expiresAt <= t) this.orders.delete(k);
    }

    startSweeper(intervalMs = 60 * 1000) {
        if (this.sweeper) return;
        this.sweeper = setInterval(() => this.sweep(), intervalMs);
        this.sweeper.unref();
    }

    stopSweeper() {
        if (this.sweeper) clearInterval(this.sweeper);
        this.sweeper = null;
    }
}

module.exports = { CaseStore };
