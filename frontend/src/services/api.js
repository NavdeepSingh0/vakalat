const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchCaptcha(courtType = 'district') {
    const res = await fetch(`${API_BASE}/api/captcha?courtType=${courtType}`);
    if (!res.ok) throw new Error('Failed to load CAPTCHA');
    return res.json(); // { sessionId, captchaDataUrl, courtType, expiresIn }
}

export async function submitCNR(cnr, captcha, sessionId) {
    const res = await fetch(`${API_BASE}/api/case/cnr/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnr, captcha, sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lookup failed');
    return data; // { source, fresh, data: {...caseData} }
}

export async function getCase(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}`);
    if (!res.ok) throw new Error('Case not found');
    return res.json();
}

export async function getDemoCases() {
    const res = await fetch(`${API_BASE}/api/demo-cases`);
    if (!res.ok) throw new Error('Failed to fetch demo cases');
    return res.json(); // array of { cnr, title, court, currentStage, totalStages, totalHearings, nextHearingDate }
}

export async function getCaseSummary(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/summary`);
    if (!res.ok) throw new Error('Failed to fetch case summary');
    return res.json();
}

export async function getQuestions(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/questions`);
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
}

export async function getWhatsAppLink(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/whatsapp`);
    if (!res.ok) throw new Error('Failed to get WhatsApp link');
    return res.json(); // { whatsappUrl, message }
}

export async function getHearings(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/hearings`);
    if (!res.ok) throw new Error('Failed to fetch hearings');
    return res.json();
}

export async function getStage(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/stage`);
    if (!res.ok) throw new Error('Failed to fetch stage');
    return res.json();
}

export async function getLawyerStats(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/lawyer-stats`);
    if (!res.ok) throw new Error('Failed to fetch lawyer stats');
    return res.json();
}

export async function getPrep(cnr) {
    const res = await fetch(`${API_BASE}/api/case/${encodeURIComponent(cnr)}/prep`);
    if (!res.ok) throw new Error('Failed to fetch prep info');
    return res.json();
}
