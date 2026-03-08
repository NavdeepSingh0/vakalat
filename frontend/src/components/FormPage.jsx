import { useState, useEffect } from "react";
import { StickyNav, Footer, Tag } from "./Shared";
import { fetchCaptcha, submitCNR, getCase, getDemoCases } from "../services/api";
import { normalizeCaseData } from "../utils";

const FormPage = ({ setPage, onCaseLoaded }) => {
    const [cnr, setCnr] = useState("");
    const [captchaCode, setCaptchaCode] = useState("");
    const [error, setError] = useState("");
    const [cnrError, setCnrError] = useState("");
    const [loading, setLoading] = useState(false);

    // CAPTCHA state
    const [captchaImg, setCaptchaImg] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [captchaLoading, setCaptchaLoading] = useState(false);

    // Demo cases
    const [demoCases, setDemoCases] = useState([]);

    // Fetch CAPTCHA on mount
    useEffect(() => { loadCaptcha(); loadDemoCases(); }, []);

    async function loadCaptcha() {
        setCaptchaLoading(true);
        setError("");
        try {
            const data = await fetchCaptcha();
            setCaptchaImg(data.captchaDataUrl);
            setSessionId(data.sessionId);
            setCaptchaCode("");
        } catch (err) {
            setError("Failed to load CAPTCHA. Is the backend running on port 3000?");
        } finally {
            setCaptchaLoading(false);
        }
    }

    async function loadDemoCases() {
        try {
            const cases = await getDemoCases();
            setDemoCases(cases);
        } catch { /* silent — demo cases are optional */ }
    }

    const handleCnr = (e) => {
        const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
        setCnr(v);
        if (cnrError) setCnrError("");
    };

    const validateCnr = () => {
        if (!cnr.length) return;
        if (cnr.length !== 16) setCnrError(`CNR must be 16 characters. You've entered ${cnr.length}.`);
        else setCnrError("");
    };

    // Live search with CAPTCHA
    const handleSubmit = async () => {
        if (cnr.length !== 16) { setCnrError("CNR must be exactly 16 characters."); return; }
        if (!captchaCode.trim()) { setError("Please enter the CAPTCHA code."); return; }
        if (!sessionId) { setError("No CAPTCHA session. Click Refresh."); return; }

        setLoading(true);
        setError("");
        try {
            const result = await submitCNR(cnr, captchaCode, sessionId);
            const caseData = result.data || result;
            const normalized = normalizeCaseData({ ...caseData, source: 'ecourts_live' });
            onCaseLoaded(normalized, cnr.toUpperCase());
            setPage("case");
        } catch (err) {
            setError(err.message || "Search failed. Try again.");
            loadCaptcha(); // Always refresh CAPTCHA on error
        } finally {
            setLoading(false);
        }
    };

    // Demo case click — direct lookup, no CAPTCHA
    const handleDemoClick = async (demoCnr) => {
        setCnr(demoCnr);
        setLoading(true);
        setError("");
        try {
            const caseData = await getCase(demoCnr);
            const normalized = normalizeCaseData({ ...caseData, source: 'demo' });
            onCaseLoaded(normalized, demoCnr);
            setPage("case");
        } catch (err) {
            setError(`Demo case not found: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--ink-00)", display: "flex", flexDirection: "column" }}>
            <StickyNav setPage={setPage} />
            <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                <div style={{ maxWidth: 1100, width: "100%", display: "grid", gridTemplateColumns: "55% 43%", gap: 80, alignItems: "start" }}>

                    {/* FORM CARD */}
                    <div style={{ border: "3px solid var(--ink-100)", background: "var(--ink-00)", padding: 48 }}>
                        <Tag variant="dark">CNR LOOKUP</Tag>
                        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "1.75rem", color: "var(--ink-100)", marginTop: 16, lineHeight: 1.1 }}>Track your case.</h2>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.9rem", color: "var(--ink-50)", marginTop: 8 }}>Enter your 16-character CNR number from your court papers.</p>

                        {/* CNR Input */}
                        <div style={{ marginTop: 32 }}>
                            <label style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-50)", display: "block", marginBottom: 8 }}>CNR NUMBER</label>
                            <input
                                value={cnr} onChange={handleCnr} onBlur={validateCnr}
                                placeholder="e.g. MHNA010000012019"
                                style={{
                                    fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "1rem",
                                    padding: "14px 16px", border: `2px solid ${cnrError ? "var(--ink-90)" : "var(--ink-30)"}`,
                                    borderRadius: 0, width: "100%", background: cnrError ? "var(--ink-08)" : "var(--ink-00)",
                                    outline: "none", color: "var(--ink-90)", letterSpacing: "0.04em"
                                }}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                                {cnrError && <span style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-70)" }}>{cnrError}</span>}
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--ink-50)", marginLeft: "auto" }}>{cnr.length}/16</span>
                            </div>
                        </div>

                        {/* CAPTCHA — real from backend */}
                        <div style={{ marginTop: 24 }}>
                            <label style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-50)", display: "block", marginBottom: 8 }}>CAPTCHA VERIFICATION</label>
                            <div style={{ border: "2px solid var(--ink-15)", padding: "12px 16px", background: "var(--ink-08)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 58 }}>
                                {captchaLoading ? (
                                    <div className="shimmer" style={{ width: 160, height: 34, borderRadius: 2 }} />
                                ) : captchaImg ? (
                                    <img src={captchaImg} alt="CAPTCHA" style={{ height: 40, maxWidth: 200 }} />
                                ) : (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--ink-50)" }}>No CAPTCHA loaded</span>
                                )}
                                <button onClick={loadCaptcha} disabled={captchaLoading}
                                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-50)", background: "none", border: "none", cursor: "pointer" }}>
                                    ↺ Refresh
                                </button>
                            </div>
                            <input
                                value={captchaCode} onChange={e => { setCaptchaCode(e.target.value); setError(""); }}
                                placeholder="Enter CAPTCHA code"
                                style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", padding: "14px 16px", border: "2px solid var(--ink-30)", borderRadius: 0, width: "100%", outline: "none", color: "var(--ink-90)" }}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ background: "var(--ink-100)", color: "#fff", padding: "14px 18px", marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.875rem" }}>
                                ✕ &nbsp;{error}
                            </div>
                        )}

                        {/* Submit */}
                        <button onClick={handleSubmit} disabled={loading} style={{
                            marginTop: 32, width: "100%", background: loading ? "var(--ink-70)" : "var(--ink-100)",
                            color: "#fff", padding: "18px 0", border: "none", borderRadius: 0, cursor: loading ? "not-allowed" : "pointer",
                            fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.875rem", letterSpacing: "0.1em", textTransform: "uppercase",
                            transition: "background 0.15s"
                        }}>
                            {loading
                                ? <span>FETCHING CASE DATA &nbsp;<span className="dot" /><span className="dot" /><span className="dot" /></span>
                                : "TRACK THIS CASE →"
                            }
                        </button>

                        {/* DEMO CASES */}
                        <div style={{ marginTop: 32 }}>
                            <div style={{ borderTop: "1px solid var(--ink-15)", marginBottom: 16 }} />
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 12 }}>DEMO CASES — CLICK TO LOAD (NO CAPTCHA)</p>
                            {(demoCases.length > 0 ? demoCases : [
                                { cnr: "MHNA010000012019", title: "Priya Sharma vs. Rajesh Sharma" },
                                { cnr: "UPLU020000052020", title: "Ramesh Yadav vs. Suresh Yadav" },
                                { cnr: "DLND030000032021", title: "Quick Solutions vs. Arjun Enterprises" },
                            ]).map((demo) => (
                                <div key={demo.cnr} onClick={() => handleDemoClick(demo.cnr)} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "10px 8px", borderBottom: "1px solid var(--ink-08)", cursor: "pointer",
                                    transition: "background 0.1s"
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = "var(--ink-04)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "0.85rem", color: "var(--ink-90)" }}>{demo.cnr}</span>
                                    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-50)" }}>{demo.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONTEXT PANEL */}
                    <div style={{ background: "var(--ink-04)", border: "1px solid var(--ink-15)", padding: 40, alignSelf: "flex-start" }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)" }}>WHERE TO FIND YOUR CNR</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.9rem", color: "var(--ink-70)", marginTop: 16, lineHeight: 1.7 }}>Your Case Number Record (CNR) is a 16-character code that uniquely identifies your case in the Indian court system:</p>
                        <div style={{ background: "var(--ink-100)", padding: "14px 20px", marginTop: 16 }}>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "1.05rem", letterSpacing: "0.04em" }}>MHNA 01 000001 2019</p>
                            <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
                                {[["MH", "State"], ["NA", "Court"], ["01", "District"], ["000001", "Case no."], ["2019", "Year"]].map(([code, label]) => (
                                    <div key={code}>
                                        <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink-30)", fontSize: "0.75rem" }}>{code}</p>
                                        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.65rem", color: "var(--ink-50)", marginTop: 2 }}>{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ borderTop: "1px solid var(--ink-15)", margin: "24px 0" }} />
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)" }}>YOU CAN FIND IT ON</p>
                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                            {["Your original court petition (vakalatnama)", "Any court notice or summons you received", "Your advocate's case tracking receipts", "The eCourts Services app (search by name)"].map(t => (
                                <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink-100)", fontSize: "1rem", flexShrink: 0, marginTop: -2 }}>—</span>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.875rem", color: "var(--ink-70)" }}>{t}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: "1px solid var(--ink-15)", margin: "24px 0" }} />
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 12 }}>ABOUT THIS DATA</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-70)", lineHeight: 1.7 }}>Vakalat fetches data from eCourts.gov.in. Data accuracy depends on what courts have entered into the system.</p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default FormPage;
