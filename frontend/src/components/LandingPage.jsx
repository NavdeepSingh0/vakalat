import { useState, useEffect, useRef } from "react";
import { StickyNav, Footer } from "./Shared";
import { useReveal } from "../utils";

const LandingPage = ({ setPage }) => {
    useReveal();
    const statRef = useRef(null);
    const [counted, setCounted] = useState(false);
    const [stat1, setStat1] = useState("0");

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !counted) {
                setCounted(true);
                let target = 4.5; const dur = 1600;
                const t0 = performance.now();
                const step = (now) => {
                    const p = Math.min((now - t0) / dur, 1);
                    const ease = 1 - Math.pow(1 - p, 3);
                    setStat1((ease * target).toFixed(1));
                    if (p < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }
        }, { threshold: 0.3 });
        if (statRef.current) obs.observe(statRef.current);
        return () => obs.disconnect();
    }, [counted]);

    return (
        <div style={{ background: "var(--ink-00)" }}>
            <StickyNav setPage={setPage} />

            {/* HERO */}
            <section style={{
                minHeight: "92vh", display: "grid", gridTemplateColumns: "7fr 5fr",
                alignItems: "center", padding: "clamp(80px,12vh,140px) clamp(24px,4vw,80px)",
                maxWidth: 1280, margin: "0 auto", gap: 80
            }}>
                <div>
                    <p data-reveal style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 24 }}>
                        LEGAL CASE TRACKER — INDIA
                    </p>
                    <h1 data-reveal data-delay="1" style={{ fontFamily: "var(--font-serif)", fontWeight: 900, fontSize: "clamp(3.5rem,8vw,7rem)", letterSpacing: "-0.03em", lineHeight: 0.92, color: "var(--ink-100)" }}>
                        Your case.<br />
                        Explained.<br />
                        <em>Finally.</em>
                    </h1>
                    <span data-reveal data-delay="2" className="line-wipe" style={{ display: "block", width: 64, height: 3, background: "var(--ink-100)", margin: "32px 0" }} />
                    <p data-reveal data-delay="3" style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "clamp(1rem,1.5vw,1.2rem)", color: "var(--ink-70)", maxWidth: 520, lineHeight: 1.65 }}>
                        eCourts data, decoded for real people. Enter your CNR number and instantly understand your case stage, hearing history, what your lawyer should be doing, and what it's costing you.
                    </p>
                    <div data-reveal data-delay="4" style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 48 }}>
                        <button onClick={() => setPage("form")} style={{
                            background: "var(--ink-100)", color: "#fff",
                            fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase",
                            padding: "14px 28px", border: "none", borderRadius: 0, cursor: "pointer",
                            transition: "background 0.15s ease"
                        }}
                            onMouseEnter={e => e.target.style.background = "var(--ink-70)"}
                            onMouseLeave={e => e.target.style.background = "var(--ink-100)"}>
                            TRACK MY CASE →
                        </button>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--ink-50)" }}>Free. No registration.</span>
                    </div>
                </div>

                {/* Hero data card */}
                <div data-reveal data-delay="2" style={{ background: "var(--ink-100)", padding: 40, borderRadius: 0 }}>
                    <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>SAMPLE CASE — MHNA010000012019</p>
                    <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "#fff", fontSize: "1.2rem", marginTop: 8 }}>Civil Judge Senior Division<br />Nagpur</p>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", margin: "24px 0" }} />
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>CURRENT STAGE</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "#fff", fontSize: "1rem" }}>Plaintiff's Evidence</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.875rem", marginTop: 4, lineHeight: 1.5 }}>The petitioner is presenting documents and witnesses to support their claim.</p>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", margin: "24px 0" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>NEXT HEARING</p>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "#fff", fontSize: "1rem", marginTop: 4 }}>14 APR 2025</p>
                        </div>
                        <div>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--ink-50)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>ADJOURNMENTS</p>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "#fff", fontSize: "1rem", marginTop: 4 }}>11 of 14</p>
                        </div>
                    </div>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-50)", fontSize: "0.7rem", marginTop: 24, fontStyle: "italic" }}>This is a real demo case from eCourts data.</p>
                </div>
            </section>

            {/* STATS BAND */}
            <div ref={statRef} style={{ background: "var(--ink-100)", padding: "40px clamp(24px,4vw,80px)", overflow: "hidden" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32 }}>
                    {[
                        [`${stat1} Crore`, "Cases pending in Indian courts"],
                        ["17 Years", "Average civil case duration"],
                        ["₹1.2 Lakh", "Average total legal spend per family"],
                    ].map(([num, label], i) => (
                        <div key={i} style={{ textAlign: "center", flex: 1 }}>
                            <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "clamp(2rem,4vw,3rem)" }}>{num}</p>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.875rem", marginTop: 8 }}>{label}</p>
                        </div>
                    ))}
                    <p style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.65rem", alignSelf: "flex-end", whiteSpace: "nowrap" }}>Source: NJDG, 2024</p>
                </div>
            </div>

            {/* HOW IT WORKS */}
            <section style={{ background: "var(--ink-04)", padding: "clamp(64px,8vh,120px) clamp(24px,4vw,80px)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <p data-reveal style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-50)" }}>THE PROCESS</p>
                    <span data-reveal data-delay="1" className="line-wipe" style={{ marginTop: 16 }} />
                    <h2 data-reveal data-delay="2" style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "clamp(1.5rem,2.5vw,2.1rem)", color: "var(--ink-100)", maxWidth: 540, margin: "16px 0 64px" }}>Three steps from confusion to clarity.</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--ink-100)" }}>
                        {[
                            { num: "STEP 01", title: "Enter Your CNR", body: "Your Case Number Record (CNR) is the 16-digit identifier printed on every court notice and filing receipt.", extra: <div style={{ background: "var(--ink-100)", padding: "10px 16px", marginTop: 16 }}><p style={{ fontFamily: "var(--font-mono)", color: "#fff", fontSize: "0.875rem" }}>MHNA010000012019</p></div> },
                            { num: "STEP 02", title: "We Fetch Live Data", body: "Vakalat connects directly to the eCourts portal. The latest hearing data, pulled in real time with CAPTCHA verification." },
                            { num: "STEP 03", title: "Read Plain English", body: "Court data is full of codes like 'PE', 'NNFR', 'WS'. Vakalat translates every code into a sentence your family can understand." },
                        ].map((step, i) => (
                            <div key={i} data-reveal data-delay={`${i + 1}`} style={{ background: i === 1 ? "var(--ink-00)" : "var(--ink-04)", padding: "40px 32px" }}>
                                <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.16em", color: "var(--ink-50)" }}>{step.num}</p>
                                <div style={{ borderTop: "1px solid var(--ink-15)", margin: "16px 0" }} />
                                <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "1.375rem", color: "var(--ink-100)", lineHeight: 1.2 }}>{step.title}</h3>
                                <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.9rem", color: "var(--ink-70)", lineHeight: 1.7, marginTop: 12 }}>{step.body}</p>
                                {step.extra}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* THE PROBLEM */}
            <section style={{ background: "var(--ink-100)", padding: "clamp(64px,8vh,120px) clamp(24px,4vw,80px)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "7fr 5fr", gap: 64, alignItems: "center" }}>
                    <div data-reveal>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-30)", marginBottom: 24 }}>THE SCALE OF THE PROBLEM</p>
                        <blockquote style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontStyle: "italic", fontSize: "clamp(1.75rem,3.5vw,2.8rem)", color: "#fff", lineHeight: 1.15 }}>
                            "The average Indian family spends 17 years and lakhs of rupees on a court case — without ever understanding what is happening."
                        </blockquote>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.8rem", color: "var(--ink-50)", marginTop: 24 }}>— NJDG Case Flow Analysis, 2023</p>
                    </div>
                    <div data-reveal data-delay="2">
                        {[["64%", "of hearings end in adjournment with no progress"], ["3 Crore", "civil cases pending for more than 5 years"], ["₹1.2L", "average total legal spend per family over a decade"]].map(([num, label], i) => (
                            <div key={i}>
                                <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "2.5rem" }}>{num}</p>
                                <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-30)", fontSize: "0.875rem", marginTop: 4, maxWidth: 200, lineHeight: 1.5 }}>{label}</p>
                                {i < 2 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "24px 0" }} />}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section style={{ background: "var(--ink-00)", padding: "clamp(64px,8vh,120px) clamp(24px,4vw,80px)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <p data-reveal style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-50)" }}>FEATURES</p>
                    <span data-reveal data-delay="1" className="line-wipe" style={{ marginTop: 16 }} />
                    <h2 data-reveal data-delay="2" style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "clamp(1.5rem,2.5vw,2.1rem)", color: "var(--ink-100)", maxWidth: 600, margin: "16px 0 64px" }}>Everything your lawyer knows. Now you do too.</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 0, border: "3px solid var(--ink-100)" }}>
                        {[
                            ["01", "Case Stage Tracker", "See exactly where your case sits in the 8-stage Indian court process. Know if you're being kept in the dark."],
                            ["02", "Plain-English Hearings", "Court records use codes like 'NNFR', 'WS', 'PE'. We translate every single one into a plain sentence."],
                            ["03", "Financial Drain Calculator", "Enter your lawyer fees, travel cost, and lost wages. Vakalat calculates the real financial toll of every adjournment."],
                            ["04", "Lawyer Questions Generator", "Based on your exact case stage, Vakalat gives you 4–5 specific questions to ask your lawyer at the next hearing."],
                            ["05", "Delay Accountability Report", "Is your lawyer skipping hearings? We compare their adjournment rate against the court average and tell you who's really causing delays."],
                            ["06", "Pre-Hearing Prep Card", "Countdown to next hearing, interactive prep checklist, stage-specific guidance, and top questions — so you walk in prepared."],
                            ["07", "Speedy Trial Alert", "If your case exceeds NJDG benchmarks, we alert you to Article 21 rights and CPC Section 89 options for faster resolution."],
                            ["08", "Add to Calendar", "One click to add your next hearing to Google Calendar or download an ICS file. Never miss a hearing date again."],
                        ].map(([num, title, body], i) => (
                            <div key={i} data-reveal data-delay={`${Math.min(i + 1, 4)}`} style={{
                                padding: "40px 32px",
                                borderRight: i % 2 === 0 ? "3px solid var(--ink-100)" : "none",
                                borderBottom: i < 6 ? "3px solid var(--ink-100)" : "none"
                            }}>
                                <p style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.14em", color: "var(--ink-50)" }}>{num}</p>
                                <div style={{ borderTop: "1px solid var(--ink-15)", margin: "16px 0" }} />
                                <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "1.375rem", color: "var(--ink-100)" }}>{title}</h3>
                                <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: "0.9rem", color: "var(--ink-70)", lineHeight: 1.7, marginTop: 12 }}>{body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TRUST */}
            <section style={{ background: "var(--ink-100)", padding: "80px clamp(24px,4vw,80px)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "var(--ink-30)" }}>
                    {[
                        ["SOURCE", "All data is fetched directly from eCourts.gov.in — the official Government of India courts database."],
                        ["PRIVACY", "Vakalat does not store your personal data or share it with third parties. CNR numbers are never logged."],
                        ["ACCESS", "Free for all users. No account, no registration, no subscription. Vakalat is a public utility."],
                    ].map(([label, text], i) => (
                        <div key={i} data-reveal data-delay={`${i + 1}`} style={{ background: "var(--ink-04)", padding: 40 }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-50)" }}>{label}</p>
                            <p style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "1.05rem", color: "var(--ink-100)", lineHeight: 1.55, marginTop: 16 }}>{text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default LandingPage;
