import { useState, useEffect } from "react";
import { StickyNav, Footer, Tag } from "./Shared";
import { useReveal, fmt, STAGES } from "../utils";
import { getQuestions, getWhatsAppLink, getPrep } from "../services/api";
import { calculateAdjournmentImpact } from "../adjournmentFormula";

const CaseDashboard = ({ setPage, caseData }) => {
    useReveal();

    const d = caseData;
    const hearings = d.hearings || [];
    const heardCount = hearings.filter(h => h.isAdjournment === false).length;
    const adjCount = hearings.length - heardCount; // adjourned + unknown = unproductive
    const adjPct = hearings.length > 0 ? Math.round((adjCount / hearings.length) * 100) : 0;
    const stageId = d.caseDetails.stageId || 5;

    // Cost Calculator State for v3.2 Formula
    const [workerType, setWorkerType] = useState("salaried_formal");
    const [travelMode, setTravelMode] = useState("local");
    const [seniorFee, setSeniorFee] = useState(32500);

    const yearsElapsed = d.caseDetails.filingDate
        ? Math.max(1, Math.floor((new Date() - new Date(d.caseDetails.filingDate)) / (365.25 * 86400000)))
        : 0;

    // Map our backend hearings array to the formula's expected format
    const formulaHearings = hearings.map(h => {
        // Map backend classification to formula fault type
        let fault = "court_system"; // Default
        if (h.classification === "adjourned_lawyer") fault = "own_side";
        else if (h.classification === "adjourned_other") fault = "mutual_consent";
        else if (h.purpose?.toLowerCase().includes("opposite")) fault = "opposite_party";

        // Map numeric stage ID to formula stage string
        let stageStr = "interlocutory";
        const sid = d.caseDetails.stageId || 5;
        if (sid <= 2) stageStr = "filing_admission";
        else if (sid <= 3) stageStr = "notice_service";
        else if (sid <= 5) stageStr = "evidence";
        else if (sid <= 7) stageStr = "final_arguments";
        else if (sid === 8) stageStr = "order_reserved";

        return {
            date: h.date,
            stage: stageStr,
            fault,
            adjourned: h.isAdjournment === true,
            reason: h.businessPlainEnglish,
        };
    });

    // Run the formula
    const impact = calculateAdjournmentImpact(formulaHearings, {
        seniorFeePerHearing: seniorFee,
        travelMode: travelMode,
        workerType: workerType,
    });

    // Lawyer questions from backend
    const [questions, setQuestions] = useState([]);
    const [openQ, setOpenQ] = useState(null);
    const [copied, setCopied] = useState(false);

    // WhatsApp
    const [waUrl, setWaUrl] = useState("");

    // Pre-hearing prep
    const [prepData, setPrepData] = useState(null);


    const cnr = d.caseDetails.cnr;

    // Speedy trial check — NJDG benchmark: civil 3 years, criminal 1 year
    const caseAgeMs = d.caseDetails.filingDate ? (new Date() - new Date(d.caseDetails.filingDate)) : 0;
    const caseAgeMonths = Math.max(0, Math.floor(caseAgeMs / (30.44 * 86400000)));
    const isCivil = !(d.caseDetails.caseType || '').toLowerCase().includes('crim');
    const benchmarkMonths = isCivil ? 36 : 12;
    const exceedsTimeline = caseAgeMonths > benchmarkMonths;
    const excessMonths = caseAgeMonths - benchmarkMonths;

    // Calendar helpers
    const nextDate = d.caseDetails.nextHearingDate ? new Date(d.caseDetails.nextHearingDate) : null;
    const calTitle = `${d.caseDetails.petitionerAdvocate || 'Case'} vs ${d.caseDetails.respondentAdvocate || 'Respondent'}`;
    const calDescription = `Court: ${d.caseDetails.courtName || '—'}\nCNR: ${cnr}\nStage: ${STAGES[Math.min(stageId, 8) - 1]?.label || '—'}`;

    const makeGoogleCalUrl = () => {
        if (!nextDate || isNaN(nextDate.getTime())) return '#';
        const ymd = nextDate.toISOString().split('T')[0].replace(/-/g, '');
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calTitle)}&dates=${ymd}/${ymd}&details=${encodeURIComponent(calDescription)}&location=${encodeURIComponent(d.caseDetails.courtName || '')}`;
    };

    const downloadICS = () => {
        if (!nextDate || isNaN(nextDate.getTime())) return;
        const ymd = nextDate.toISOString().split('T')[0].replace(/-/g, '');
        const ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vakalat//EN',
            'BEGIN:VEVENT',
            `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${ymd}`,
            `SUMMARY:${calTitle}`,
            `DESCRIPTION:${calDescription.replace(/\n/g, '\\n')}`,
            `LOCATION:${d.caseDetails.courtName || ''}`,
            'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        const blob = new Blob([ics], { type: 'text/calendar' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `hearing_${cnr}.ics`; a.click();
    };

    useEffect(() => {
        if (!cnr) return;
        getQuestions(cnr).then(data => {
            const qs = (data.questions || []).map((q, i) => ({
                q,
                why: (data.contextualQuestions && data.contextualQuestions[i]) || `This question is relevant to the ${data.stageName || 'current'} stage of your case.`
            }));
            if (qs.length > 0) setQuestions(qs);
        }).catch(() => { });

        getWhatsAppLink(cnr).then(data => setWaUrl(data.whatsappUrl || "")).catch(() => { });

        getPrep(cnr).then(data => setPrepData(data)).catch(() => { });
    }, [cnr]);

    // Fallback questions if backend fails
    const displayQuestions = questions.length > 0 ? questions : [
        { q: "Which witnesses have we listed and when will they be examined?", why: "At the plaintiff's evidence stage, only certified copies are admissible." },
        { q: "Have all our documents been properly marked as exhibits?", why: "Courts require a formal exhibit list. Missing this step causes procedural delays." },
        { q: "What is the strongest piece of evidence we have and is it submitted?", why: "Your lawyer should have anticipated counter-arguments in advance." },
        { q: "What will happen if a witness fails to appear on the next date?", why: "Non-appearance of a witness results in an automatic adjournment." },
        { q: "How many more hearings do you estimate before we finish our evidence?", why: "You deserve to know the contingency plan." },
    ];

    const copyAll = () => {
        const qs = displayQuestions.map((q, i) => `${i + 1}. ${q.q}`).join("\n");
        navigator.clipboard.writeText(qs);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const lastHearing = hearings[0]; // newest first

    return (
        <div style={{ background: "var(--ink-00)" }}>
            <StickyNav variant="caseview" setPage={setPage} />

            {/* CASE HEADER */}
            <div style={{ background: "var(--ink-100)", width: "100%", padding: "40px clamp(24px,4vw,80px)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>CNR — {cnr}</p>
                            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, color: "#fff", fontSize: "clamp(1.4rem,2.2vw,2rem)", marginTop: 8, lineHeight: 1.1 }}>
                                {d.caseDetails.petitionerAdvocate || "Petitioner"}
                            </h1>
                            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-30)", fontSize: "0.875rem", marginTop: 4 }}>vs</p>
                            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, color: "#fff", fontSize: "clamp(1.4rem,2.2vw,2rem)", marginTop: 4, lineHeight: 1.1 }}>
                                {d.caseDetails.respondentAdvocate || "Respondent"}
                            </h1>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>COURT</p>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "#fff", fontSize: "0.9rem", lineHeight: 1.4, maxWidth: 280 }}>{d.caseDetails.courtName || "—"}</p>
                            {d.caseDetails.courtNumberJudge && <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-30)", fontSize: "0.8rem", marginTop: 6 }}>{d.caseDetails.courtNumberJudge}</p>}
                        </div>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 24, paddingTop: 24, display: "flex", gap: 48, flexWrap: "wrap" }}>
                        {[
                            ["CASE TYPE", d.caseDetails.caseType || "—", false],
                            ["FILED", fmt(d.caseDetails.filingDate), false],
                            ["NEXT HEARING", fmt(d.caseDetails.nextHearingDate), true],
                            ["ADVOCATES", `${d.caseDetails.petitionerLawyer || "—"} / ${d.caseDetails.respondentLawyer || "—"}`, false],
                        ].map(([label, val, isPulsing]) => (
                            <div key={label}>
                                <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
                                <p className={isPulsing ? "pulse" : ""} style={{ fontFamily: "var(--font-mono)", fontWeight: isPulsing ? 600 : 500, color: "#fff", fontSize: isPulsing ? "1rem" : "0.9rem" }}>{val}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ⚠️ SPEEDY TRIAL ALERT — Only shows if case exceeds NJDG timeline */}
            {exceedsTimeline && (
                <div data-reveal style={{ background: "#1a0a00", border: "2px solid #d4760a", margin: "0 auto", maxWidth: 1280, padding: "28px 40px", display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <div style={{ fontSize: "1.8rem", lineHeight: 1, flexShrink: 0 }}>⚖️</div>
                    <div>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#d4760a", marginBottom: 6 }}>RIGHT TO SPEEDY TRIAL ALERT</p>
                        <p style={{ fontFamily: "var(--font-serif)", fontWeight: 700, color: "#fff", fontSize: "1.1rem", lineHeight: 1.4 }}>
                            Your case has exceeded the NJDG benchmark by {excessMonths} months.
                        </p>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", lineHeight: 1.7, marginTop: 8 }}>
                            The National Judicial Data Grid recommends {isCivil ? "3 years" : "1 year"} for {isCivil ? "civil" : "criminal"} cases at the district level.
                            Your case has been pending for <strong style={{ color: "#fff" }}>{Math.floor(caseAgeMonths / 12)} years, {caseAgeMonths % 12} months</strong>.
                        </p>
                        <div style={{ background: "rgba(212,118,10,0.15)", padding: "16px 20px", marginTop: 16 }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.8rem", color: "#d4760a", marginBottom: 6 }}>What you can do:</p>
                            <ul style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
                                <li><strong>Article 21</strong> of the Constitution guarantees you the right to a speedy trial. Ask your lawyer about filing an application citing this right.</li>
                                <li><strong>Section 89 CPC</strong> — You may request the court to refer the case to mediation, Lok Adalat, or arbitration for faster resolution.</li>
                                <li>Ask your lawyer: <em>"Can we file an application for early hearing or priority listing?"</em></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px clamp(24px,4vw,80px) 80px", display: "grid", gridTemplateColumns: "380px 1fr", gap: 32 }}>

                {/* LEFT COLUMN — Progress + Details */}
                <div>
                    {/* PROGRESS BAR */}
                    <div data-reveal style={{ border: "3px solid var(--ink-100)", overflow: "hidden" }}>
                        <div style={{ background: "var(--ink-100)", padding: "20px 24px" }}>
                            <Tag variant="white-outline">CASE PROGRESS</Tag>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "#fff", fontSize: "0.875rem", marginTop: 8 }}>
                                Stage {stageId} of 8 — {STAGES[Math.min(stageId, 8) - 1]?.label || "Unknown"}
                            </p>
                        </div>
                        <div style={{ padding: 24 }}>
                            {STAGES.map((stage, i) => {
                                const status = stage.id < stageId ? "done" : stage.id === stageId ? "current" : "upcoming";
                                return (
                                    <div key={stage.id}>
                                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                                            <div style={{
                                                width: 32, height: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                                background: status === "upcoming" ? "transparent" : "var(--ink-100)",
                                                border: status === "upcoming" ? "2px solid var(--ink-15)" : status === "current" ? "3px solid var(--ink-100)" : "none",
                                                outline: status === "current" ? "3px solid var(--ink-30)" : "none",
                                                outlineOffset: status === "current" ? 2 : 0,
                                            }}>
                                                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.7rem", color: status === "upcoming" ? "var(--ink-30)" : "#fff" }}>
                                                    {status === "done" ? "✓" : stage.id}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, paddingBottom: status === "current" ? 0 : 8 }}>
                                                <p style={{
                                                    fontFamily: "var(--font-sans)", fontWeight: status === "current" ? 700 : 600,
                                                    fontSize: status === "current" ? "0.875rem" : "0.8rem",
                                                    color: status === "done" ? "var(--ink-30)" : status === "current" ? "var(--ink-100)" : "var(--ink-30)",
                                                    textDecoration: status === "done" ? "line-through" : "none",
                                                }}>{stage.label}</p>
                                                {status === "current" && (
                                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-70)", marginTop: 4, lineHeight: 1.6 }}>
                                                        {stage.plainEnglish}
                                                    </p>
                                                )}
                                                {status === "upcoming" && (
                                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--ink-30)", marginTop: 2 }}>~{stage.avgMonths} months avg</p>
                                                )}
                                            </div>
                                        </div>
                                        {i < STAGES.length - 1 && (
                                            <div style={{ width: 1, height: 16, background: status === "done" ? "var(--ink-100)" : "var(--ink-15)", marginLeft: 15, marginTop: 2, marginBottom: 2 }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ borderTop: "1px solid var(--ink-15)", padding: "16px 24px" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.75rem", color: "var(--ink-50)" }}>
                                Est. time remaining: ~{STAGES.slice(stageId).reduce((s, st) => s + st.avgMonths, 0)} months (NJDG avg)
                            </p>
                        </div>
                    </div>

                    {/* CASE DETAILS CARD */}
                    <div data-reveal style={{ border: "3px solid var(--ink-100)", marginTop: 32 }}>
                        <div style={{ background: "var(--ink-100)", padding: "20px 24px" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>CASE DETAILS</p>
                        </div>
                        <div style={{ padding: "24px" }}>
                            {[
                                ["CASE TYPE", d.caseDetails.caseType],
                                ["REG. DATE", fmt(d.caseDetails.registrationDate)],
                                ["FIRST HEARING", fmt(d.caseDetails.firstHearingDate)],
                                ["PETITIONER'S ADVOCATE", d.caseDetails.petitionerLawyer || "—"],
                                ["RESPONDENT'S ADVOCATE", d.caseDetails.respondentLawyer || "—"],
                            ].map(([label, val]) => (
                                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--ink-08)", gap: 16 }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", flexShrink: 0 }}>{label}</p>
                                    <p style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-70)", textAlign: "right" }}>{val || "—"}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div>
                    {/* LAST HEARING CARD */}
                    {lastHearing && (
                        <div data-reveal style={{ background: "var(--ink-100)", padding: 32 }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-30)" }}>LAST HEARING</p>
                            <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.8rem", marginTop: 4 }}>{fmt(lastHearing.date)}</p>
                            <div style={{ marginTop: 16 }}>
                                {lastHearing.isAdjournment !== null && (
                                    <Tag variant={lastHearing.isAdjournment ? "white-outline" : "dark"}>
                                        {lastHearing.isAdjournment ? "ADJOURNED" : "HEARD"}
                                    </Tag>
                                )}
                            </div>
                            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "#fff", fontSize: "1.35rem", lineHeight: 1.4, marginTop: 24 }}>
                                "{lastHearing.businessPlainEnglish}"
                            </p>
                            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 32, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <div>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>NEXT HEARING DATE</p>
                                    <p className="pulse" style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "1.375rem", marginTop: 4 }}>{fmt(d.caseDetails.nextHearingDate)}</p>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.8rem" }}>Purpose of next hearing:</p>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "#fff", fontSize: "0.875rem", marginTop: 4 }}>{lastHearing.purpose}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HEARING HISTORY TABLE */}
                    <div data-reveal style={{ border: "3px solid var(--ink-100)", marginTop: 32, overflow: "hidden" }}>
                        <div style={{ background: "var(--ink-100)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>HEARING HISTORY</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "#fff", fontSize: "0.875rem" }}>{hearings.length} hearings</span>
                                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.75rem" }}>— {adjCount} unproductive ({adjPct}%)</span>
                            </div>
                        </div>
                        <div style={{ height: 6, background: "var(--ink-08)" }}>
                            <div style={{ height: "100%", width: `${adjPct}%`, background: "var(--ink-100)", transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ maxHeight: 400, overflowY: "auto", overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead style={{ position: "sticky", top: 0, background: "var(--ink-08)", borderBottom: "2px solid var(--ink-100)" }}>
                                    <tr>
                                        {["DATE", "WHAT HAPPENED", "STATUS"].map(h => (
                                            <th key={h} style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-50)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {hearings.map((h, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? "var(--ink-00)" : "var(--ink-08)", borderBottom: "1px solid var(--ink-15)", transition: "background 0.1s" }}>
                                            <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--ink-70)", padding: "14px 16px", whiteSpace: "nowrap" }}>{fmt(h.date)}</td>
                                            <td style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--ink-70)", padding: "14px 16px", lineHeight: 1.5, maxWidth: 300 }}>{h.businessPlainEnglish}</td>
                                            <td style={{ padding: "14px 16px" }}>
                                                {h.isAdjournment !== null
                                                    ? <Tag variant={h.isAdjournment ? "dark" : "outline"}>{h.isAdjournment ? "ADJOURNED" : "HEARD"}</Tag>
                                                    : <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--ink-30)" }}>{h.purpose}</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* FULL WIDTH: COST CALCULATOR */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,4vw,80px) 40px" }}>
                <div data-reveal style={{ border: "3px solid var(--ink-100)", overflow: "hidden" }}>
                    <div style={{ background: "var(--ink-100)", padding: "20px 32px" }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>FINANCIAL DRAIN CALCULATOR</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.8rem", marginTop: 4 }}>Estimate what this case has cost your family. Edit the values below.</p>
                    </div>
                    <div style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
                        <div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                                <div>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 8 }}>LAWYER FEE PER HEARING (₹)</p>
                                    <div style={{ display: "flex", alignItems: "center", border: "2px solid var(--ink-30)" }}>
                                        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: "var(--ink-70)", padding: "0 8px 0 12px" }}>₹</span>
                                        <input type="number" value={seniorFee} min={0} step={1000}
                                            onChange={e => setSeniorFee(Number(e.target.value))}
                                            style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "1rem", border: "none", outline: "none", padding: "12px", flex: 1, backgroundColor: "transparent", color: "var(--ink-90)" }} />
                                    </div>
                                </div>
                                <div>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 8 }}>YOUR PROFESSION (OPPORTUNITY COST)</p>
                                    <select value={workerType} onChange={e => setWorkerType(e.target.value)}
                                        style={{ width: "100%", padding: "12px", fontFamily: "var(--font-sans)", fontSize: "0.9rem", border: "2px solid var(--ink-30)", backgroundColor: "transparent", color: "var(--ink-90)" }}>
                                        <option value="unskilled_casual">Casual Labour / Unskilled (₹550/day)</option>
                                        <option value="skilled_informal">Skilled Informal (₹1,100/day)</option>
                                        <option value="salaried_formal">Salaried Formal (₹1,800/day)</option>
                                        <option value="self_employed_small">Self-Employed Small (₹4,500/day)</option>
                                        <option value="professional">Professional / Managerial (₹7,500/day)</option>
                                        <option value="senior_executive">Senior Executive (₹50,000/day)</option>
                                    </select>
                                </div>
                                <div>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 8 }}>HEARING TRAVEL REQUIRED</p>
                                    <select value={travelMode} onChange={e => setTravelMode(e.target.value)}
                                        style={{ width: "100%", padding: "12px", fontFamily: "var(--font-sans)", fontSize: "0.9rem", border: "2px solid var(--ink-30)", backgroundColor: "transparent", color: "var(--ink-90)" }}>
                                        <option value="local">Local (Auto/Cab within city)</option>
                                        <option value="outstation">Outstation (Train + Hotel)</option>
                                        <option value="intercity">Intercity (Flight + Hotel)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ background: "var(--ink-04)", border: "1px solid var(--ink-15)", padding: 32, textAlign: "center" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)" }}>TOTAL FINANCIAL DRAIN</p>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink-100)", fontSize: "clamp(2rem,4vw,3rem)", marginTop: 16, lineHeight: 1 }}>₹{impact.totalDrain.toLocaleString("en-IN")}</p>

                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "16px 0", borderTop: "1px solid var(--ink-15)" }}>
                                <div style={{ textAlign: "left" }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.7rem", color: "var(--ink-50)", textTransform: "uppercase" }}>Legal Fees</p>
                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--ink-90)", marginTop: 4 }}>₹{impact.costHeadSummary.professionalFees.toLocaleString("en-IN")}</p>
                                </div>
                                <div style={{ textAlign: "left" }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.7rem", color: "var(--ink-50)", textTransform: "uppercase" }}>Lost Opp.</p>
                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--ink-90)", marginTop: 4 }}>₹{impact.costHeadSummary.opportunityCost.toLocaleString("en-IN")}</p>
                                </div>
                                <div style={{ textAlign: "left" }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.7rem", color: "var(--ink-50)", textTransform: "uppercase" }}>Travel/Misc</p>
                                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--ink-90)", marginTop: 4 }}>₹{(impact.costHeadSummary.travelStay + impact.costHeadSummary.incidentals).toLocaleString("en-IN")}</p>
                                </div>
                            </div>

                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.875rem", color: "var(--ink-70)", lineHeight: 1.6 }}>
                                Across {impact.adjournedCount} adjournments{yearsElapsed > 0 ? ` over ${yearsElapsed} years` : ""}
                            </p>
                            <div style={{ borderTop: "1px solid var(--ink-15)", margin: "16px 0" }} />
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 12 }}>UNPRODUCTIVE RATE VS NATIONAL AVG (DAKSH)</p>
                            {[["This case", adjPct, "var(--ink-100)"], ["National avg (DAKSH)", 61, "var(--ink-30)"]].map(([label, pct, color]) => (
                                <div key={label} style={{ marginBottom: 12, textAlign: "left" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "0.75rem", color: "var(--ink-70)" }}>{label}</p>
                                        <p style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "0.75rem", color: "var(--ink-50)" }}>{pct}%</p>
                                    </div>
                                    <div style={{ height: 6, background: "var(--ink-15)", borderRadius: 0 }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.6s ease" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* FULL WIDTH: LAWYER QUESTIONS */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,4vw,80px) 40px" }}>
                {/* LAWYER QUESTIONS */}
                <div data-reveal style={{ border: "3px solid var(--ink-100)", marginTop: 40, overflow: "hidden" }}>
                    <div style={{ background: "var(--ink-100)", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>QUESTIONS FOR YOUR LAWYER</p>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.8rem", marginTop: 4 }}>
                                Tailored to Stage {stageId}: {STAGES[Math.min(stageId, 8) - 1]?.label || "—"} — for your hearing on {fmt(d.caseDetails.nextHearingDate)}
                            </p>
                        </div>
                        <button onClick={copyAll} style={{
                            background: "transparent", color: copied ? "var(--ink-30)" : "#fff",
                            border: "1px solid rgba(255,255,255,0.3)", padding: "10px 18px",
                            fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase",
                            cursor: "pointer", borderRadius: 0, transition: "all 0.15s", whiteSpace: "nowrap"
                        }}>
                            {copied ? "COPIED ✓" : "COPY ALL"}
                        </button>
                    </div>
                    {displayQuestions.map((item, i) => (
                        <div key={i} style={{ borderBottom: "1px solid var(--ink-15)" }}>
                            <button onClick={() => setOpenQ(openQ === i ? null : i)}
                                style={{
                                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "20px 32px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                                    transition: "background 0.1s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--ink-04)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                aria-expanded={openQ === i}>
                                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.7rem", color: "var(--ink-30)", marginTop: 2, flexShrink: 0 }}>0{i + 1}</span>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.95rem", color: "var(--ink-90)", lineHeight: 1.4 }}>{item.q}</p>
                                </div>
                                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink-50)", fontSize: "1.5rem", flexShrink: 0, marginLeft: 16, transition: "transform 0.2s", transform: openQ === i ? "rotate(45deg)" : "none" }}>+</span>
                            </button>
                            <div className={`acc-panel ${openQ === i ? "open" : ""}`}>
                                <div style={{ padding: "0 32px 20px 64px" }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.875rem", color: "var(--ink-70)", lineHeight: 1.7 }}>{item.why}</p>
                                    <button onClick={() => navigator.clipboard.writeText(item.q)} style={{
                                        marginTop: 12, background: "none", border: "none", cursor: "pointer",
                                        fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-50)", padding: 0,
                                        textDecoration: "underline", textUnderlineOffset: 3
                                    }}>📋 Copy this question</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--ink-15)", padding: "16px 32px" }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.75rem", color: "var(--ink-50)", fontStyle: "italic" }}>These are suggested questions only. Vakalat does not provide legal advice.</p>
                    </div>
                </div>

                {/* PRE-HEARING PREP CARD — inside same wrapper, no extra padding */}
                {prepData && (
                    <div style={{ border: "3px solid var(--ink-100)", marginTop: 40, overflow: "hidden" }}>
                        <div style={{ background: "var(--ink-100)", padding: "20px 32px" }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>PRE-HEARING PREP CARD</p>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.8rem", marginTop: 4 }}>
                                What to do before your next hearing on {fmt(d.caseDetails.nextHearingDate)}
                            </p>
                        </div>
                        <div style={{ padding: "24px 32px" }}>
                            {prepData.currentStage && (
                                <div style={{ background: "var(--ink-04)", padding: "16px 20px", marginBottom: 20 }}>
                                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 6 }}>WHAT TO EXPECT AT STAGE {prepData.currentStage.number}</p>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--ink-70)", lineHeight: 1.6 }}>{prepData.currentStage.whatToExpect}</p>
                                </div>
                            )}
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 12 }}>CHECKLIST</p>
                            {prepData.preparationChecklist.map((item, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--ink-08)" }}>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--ink-30)", flexShrink: 0 }}>☐</span>
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: item.startsWith('⚠') ? '#d4760a' : "var(--ink-70)", lineHeight: 1.5 }}>{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>


            {/* FULL WIDTH: CALENDAR + SHARE */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,4vw,80px) 40px" }}>
                {/* ADD TO CALENDAR  */}
                {nextDate && !isNaN(nextDate.getTime()) && (
                    <div data-reveal style={{ background: "var(--ink-04)", border: "3px solid var(--ink-100)", marginTop: 40, padding: "28px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                        <div>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 6 }}>NEVER MISS A HEARING</p>
                            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-90)", fontSize: "1.05rem", lineHeight: 1.4 }}>Add your next hearing date ({fmt(d.caseDetails.nextHearingDate)}) to your calendar.</p>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <a href={makeGoogleCalUrl()} target="_blank" rel="noopener noreferrer" style={{
                                display: "inline-block", background: "var(--ink-100)", color: "#fff",
                                padding: "12px 20px", textDecoration: "none", fontFamily: "var(--font-sans)",
                                fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                cursor: "pointer", transition: "opacity 0.15s"
                            }}
                                onMouseEnter={e => e.target.style.opacity = "0.8"}
                                onMouseLeave={e => e.target.style.opacity = "1"}>📅 GOOGLE CALENDAR</a>
                            <button onClick={downloadICS} style={{
                                background: "transparent", color: "var(--ink-100)",
                                border: "2px solid var(--ink-100)", padding: "12px 20px", borderRadius: 0,
                                fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.75rem",
                                letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                                transition: "all 0.15s"
                            }}
                                onMouseEnter={e => { e.target.style.background = "var(--ink-100)"; e.target.style.color = "#fff"; }}
                                onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = "var(--ink-100)"; }}>📥 DOWNLOAD .ICS</button>
                        </div>
                    </div>
                )}

                {/* SHARE BAR */}
                <div data-reveal style={{ background: "var(--ink-100)", padding: "28px 40px", marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "#fff", fontSize: "1.1rem" }}>Share this summary with your lawyer or family.</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.8rem", marginTop: 4 }}>The WhatsApp message includes case stage, next date, and cost estimate.</p>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        {[
                            ["COPY LINK", "transparent", "#fff", "1px solid rgba(255,255,255,0.4)", () => navigator.clipboard.writeText(window.location.href)],
                            ["SHARE ON WHATSAPP", "var(--ink-00)", "var(--ink-100)", "none", () => waUrl && window.open(waUrl)],
                        ].map(([label, bg, color, border, fn]) => (
                            <button key={label} onClick={fn} style={{
                                background: bg, color, border, padding: "12px 20px", borderRadius: 0,
                                fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                cursor: "pointer", transition: "opacity 0.15s", whiteSpace: "nowrap"
                            }}
                                onMouseEnter={e => e.target.style.opacity = "0.8"}
                                onMouseLeave={e => e.target.style.opacity = "1"}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 40 }}>
                <Footer />
            </div>
        </div>
    );
};

export default CaseDashboard;
