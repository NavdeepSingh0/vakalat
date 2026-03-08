// ─── FONT LOADER ─────────────────────────────────────────────────────────────
export const FontLoader = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Epilogue:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

    :root {
      --ink-100: #0A0A0A;
      --ink-90:  #1A1A1A;
      --ink-70:  #404040;
      --ink-50:  #737373;
      --ink-30:  #ABABAB;
      --ink-15:  #D6D6D6;
      --ink-08:  #EBEBEB;
      --ink-04:  #F5F5F5;
      --ink-00:  #FFFFFF;
      --font-serif: 'Playfair Display', Georgia, serif;
      --font-sans:  'Epilogue', sans-serif;
      --font-mono:  'IBM Plex Mono', monospace;
      --ease-out:    cubic-bezier(0.0,0.0,0.2,1.0);
      --ease-in-out: cubic-bezier(0.4,0.0,0.2,1.0);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-sans); background: var(--ink-00); color: var(--ink-90); }

    .serif { font-family: var(--font-serif); }
    .mono  { font-family: var(--font-mono); }
    .sans  { font-family: var(--font-sans); }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--ink-08); }
    ::-webkit-scrollbar-thumb { background: var(--ink-30); }

    .line-wipe {
      display: block; height: 3px; background: var(--ink-100);
      transform-origin: left; transform: scaleX(0);
      transition: transform 0.8s var(--ease-out);
    }
    .line-wipe.vis { transform: scaleX(1); }

    [data-reveal] {
      opacity: 0; transform: translateY(28px);
      transition: opacity 0.65s var(--ease-out), transform 0.65s var(--ease-out);
    }
    [data-reveal].vis { opacity: 1; transform: translateY(0); }
    [data-delay="1"] { transition-delay: 80ms; }
    [data-delay="2"] { transition-delay: 160ms; }
    [data-delay="3"] { transition-delay: 240ms; }
    [data-delay="4"] { transition-delay: 320ms; }

    .ul-link { position: relative; text-decoration: none; cursor: pointer; }
    .ul-link::after {
      content:''; position:absolute; bottom:-2px; left:0; width:100%; height:1px;
      background: currentColor; transform: scaleX(0);
      transform-origin: right; transition: transform 0.25s var(--ease-in-out);
    }
    .ul-link:hover::after { transform: scaleX(1); transform-origin: left; }

    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
    .pulse { animation: pulse 4s ease-in-out infinite; }

    @keyframes shimmer {
      0%{background-position:-400px 0} 100%{background-position:400px 0}
    }
    .shimmer {
      background: linear-gradient(90deg, #EBEBEB 25%, #F5F5F5 50%, #EBEBEB 75%);
      background-size: 800px 100%;
      animation: shimmer 1.5s infinite;
    }

    .acc-panel { max-height:0; overflow:hidden; transition: max-height 0.3s ease-out; }
    .acc-panel.open { max-height: 240px; }

    *:focus-visible { outline: 3px solid var(--ink-100); outline-offset: 3px; }

    @keyframes dotPulse {
      0%,100%{opacity:0.2} 40%{opacity:1}
    }
    .dot { display: inline-block; width: 4px; height: 4px; border-radius:50%; background:currentColor; animation: dotPulse 1.4s ease infinite; }
    .dot:nth-child(2){animation-delay:0.2s}
    .dot:nth-child(3){animation-delay:0.4s}

    tbody tr:hover { background: var(--ink-04) !important; }
    input[type=range] { accent-color: var(--ink-100); }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  `}</style>
);

// ─── TAG ─────────────────────────────────────────────────────────────────────
export const Tag = ({ children, variant = "dark", style = {} }) => {
    const base = {
        fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.65rem",
        letterSpacing: "0.14em", textTransform: "uppercase",
        padding: "4px 10px", borderRadius: 2, display: "inline-block", ...style
    };
    if (variant === "dark") return <span style={{ ...base, background: "var(--ink-100)", color: "#fff" }}>{children}</span>;
    if (variant === "outline") return <span style={{ ...base, background: "transparent", color: "var(--ink-70)", border: "1px solid var(--ink-30)" }}>{children}</span>;
    if (variant === "white-outline") return <span style={{ ...base, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}>{children}</span>;
    return <span style={{ ...base, background: "var(--ink-08)", color: "var(--ink-70)" }}>{children}</span>;
};

// ─── STICKY NAVBAR ───────────────────────────────────────────────────────────
export const StickyNav = ({ variant = "landing", setPage }) => (
    <nav style={{
        background: "var(--ink-100)", height: 64, position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", padding: "0 clamp(24px,4vw,80px)"
    }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 1280, margin: "0 auto" }}>
            <div onClick={() => setPage("landing")} style={{ cursor: "pointer", display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "1rem", letterSpacing: "0.08em" }}>VAKA</span>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 800, color: "#fff", fontSize: "1rem", letterSpacing: "0.04em" }}>LAT</span>
            </div>
            <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
                {variant === "caseview" && (
                    <span onClick={() => setPage("form")} className="ul-link"
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--ink-30)", letterSpacing: "0.04em", cursor: "pointer" }}>
                        ← Track Another
                    </span>
                )}
                {["TRACK A CASE", "HOW IT WORKS", "ABOUT"].map(l => (
                    <span key={l} onClick={() => setPage(l === "TRACK A CASE" ? "form" : "landing")}
                        className="ul-link"
                        style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", color: "#fff", cursor: "pointer", textTransform: "uppercase" }}>
                        {l}
                    </span>
                ))}
            </div>
        </div>
    </nav>
);

// ─── FOOTER ──────────────────────────────────────────────────────────────────
export const Footer = () => (
    <footer style={{ background: "var(--ink-100)", padding: "64px clamp(24px,4vw,80px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr", gap: 48 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 16 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff", fontSize: "1rem" }}>VAKA</span>
                        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 800, color: "#fff", fontSize: "1rem" }}>LAT</span>
                    </div>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-50)", fontSize: "0.875rem", lineHeight: 1.7, maxWidth: 280 }}>
                        Making the Indian courts system legible for families who deserve to understand what is happening to their cases.
                    </p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--ink-50)", marginTop: 24 }}>Built at Hack2Skill 2026</p>
                </div>
                {[
                    ["PRODUCT", ["Track a Case", "How It Works", "Demo Cases"]],
                    ["DATA SOURCES", ["eCourts India", "NJDG", "NIC"]],
                ].map(([label, links]) => (
                    <div key={label}>
                        <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "var(--ink-30)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>{label}</p>
                        {links.map(l => <p key={l} style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-50)", fontSize: "0.875rem", lineHeight: 2.2, cursor: "pointer" }} className="ul-link">{l}</p>)}
                    </div>
                ))}
                <div>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: "var(--ink-30)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>LEGAL</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--ink-50)", fontSize: "0.75rem", lineHeight: 1.8 }}>
                        Vakalat is not a law firm and does not provide legal advice. Data sourced from public court records. Not affiliated with the Government of India or NIC.
                    </p>
                </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 48, paddingTop: 24, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.75rem" }}>© 2026 VAKALAT</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-50)", fontSize: "0.75rem" }}>DATA: NJDG / ECOURTS.GOV.IN</span>
            </div>
        </div>
    </footer>
);
