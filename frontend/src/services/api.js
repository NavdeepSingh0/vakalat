// In development Vite proxies /api to the backend, so the default base is same-origin ('').
// For a separately hosted API set VITE_API_URL (e.g. https://api.example.com).
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
    constructor(message, { status = 0, code = 'error' } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

async function request(path, { method = 'GET', body, signal } = {}) {
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            signal,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        throw new ApiError('Cannot reach the Vakalat server. Check your connection and try again.', { code: 'network' });
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    if (!res.ok) {
        throw new ApiError((data && (data.message || data.error)) || `Request failed (${res.status})`, {
            status: res.status,
            code: (data && data.error) || 'error',
        });
    }
    return data;
}

const enc = encodeURIComponent;

export const fetchCaptcha = (courtType = 'district') => request(`/api/captcha?courtType=${enc(courtType)}`);
export const submitCNR = (cnr, captcha, sessionId) => request('/api/case/cnr/live', { method: 'POST', body: { cnr, captcha, sessionId } });
export const getDemoCases = () => request('/api/demo-cases');
export const getCase = (cnr) => request(`/api/case/${enc(cnr)}`);
export const getStage = (cnr) => request(`/api/case/${enc(cnr)}/stage`);
export const getQuestions = (cnr) => request(`/api/case/${enc(cnr)}/questions`);
export const getPrep = (cnr) => request(`/api/case/${enc(cnr)}/prep`);
export const getWhatsAppLink = (cnr) => request(`/api/case/${enc(cnr)}/whatsapp`);
export const getCostConfig = () => request('/api/cost-config');
export const estimateCost = (cnr, params, signal) => request(`/api/case/${enc(cnr)}/cost`, { method: 'POST', body: params, signal });
export const getOrderSummary = (cnr, hearingId) => request(`/api/order/${enc(cnr)}/${hearingId}/summary`);
export const orderPdfUrl = (cnr, hearingId) => `${API_BASE}/api/order/${enc(cnr)}/${hearingId}/download`;
