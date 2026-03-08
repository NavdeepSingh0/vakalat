import { useEffect, useRef, useState } from "react";
import "./HeroSection.css";
import logoImg from "../assets/logo.jpeg";

// ─────────────────────────────────────────
// FRAME CONFIG
// Frames: public/frames/ezgif-frame-001.jpg → ezgif-frame-067.jpg
// ─────────────────────────────────────────
const TOTAL_FRAMES = 67;
const FRAME_PATH = (i) =>
    `/frames/ezgif-frame-${String(i).padStart(3, "0")}.jpg`;

// ─────────────────────────────────────────
// SCROLL PHASES
// ─────────────────────────────────────────
const PHASES = [
    {
        at: 0,
        phaseLabel: "BALANCED — SCALES OF JUSTICE",
        statNum: "4.5 Cr",
        statLabel: "cases pending in Indian courts today",
    },
    {
        at: 0.28,
        phaseLabel: "THE WEIGHT OF DELAY",
        statNum: "17 yrs",
        statLabel: "average time to resolve a civil case",
    },
    {
        at: 0.58,
        phaseLabel: "THE SWORD LOWERS",
        statNum: "64%",
        statLabel: "of all hearings end in adjournment",
    },
    {
        at: 0.82,
        phaseLabel: "JUSTICE DENIED",
        statNum: "₹1.2L",
        statLabel: "average cost to an Indian family per decade",
    },
];

export default function HeroSection({ setPage }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const framesRef = useRef([]);
    const currentFrameRef = useRef(0);
    const currentPhaseRef = useRef(0);

    const [framesLoaded, setFramesLoaded] = useState(false);
    const [phaseLabel, setPhaseLabel] = useState(PHASES[0].phaseLabel);
    const [statNum, setStatNum] = useState(PHASES[0].statNum);
    const [statLabel, setStatLabel] = useState(PHASES[0].statLabel);
    const [activeDot, setActiveDot] = useState(0);
    const [progressPct, setProgressPct] = useState(0);

    // ── Frame preload ──
    useEffect(() => {
        let loaded = 0;
        const images = [];
        for (let i = 1; i <= TOTAL_FRAMES; i++) {
            const img = new Image();
            img.src = FRAME_PATH(i);
            img.onload = () => {
                loaded++;
                if (loaded === TOTAL_FRAMES) {
                    framesRef.current = images;
                    setFramesLoaded(true);
                    drawFrame(0, images);
                }
            };
            img.onerror = () => {
                loaded++;
                if (loaded === TOTAL_FRAMES) {
                    framesRef.current = images;
                    setFramesLoaded(true);
                    drawFrame(0, images);
                }
            };
            images.push(img);
        }
    }, []);

    // ── Draw frame ──
    const drawFrame = (index, images) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const img = images[index];
        if (!img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };

    // ── Phase switcher ──
    const setPhase = (index) => {
        if (currentPhaseRef.current === index) return;
        currentPhaseRef.current = index;
        const p = PHASES[index];
        setPhaseLabel(p.phaseLabel);
        setStatNum(p.statNum);
        setStatLabel(p.statLabel);
        setActiveDot(index);
    };

    // ── Scroll handler ──
    useEffect(() => {
        if (!framesLoaded) return;

        const handleScroll = () => {
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const scrollHeight = container.offsetHeight - window.innerHeight;
            const scrolled = -rect.top;
            const progress = Math.min(Math.max(scrolled / scrollHeight, 0), 1);

            setProgressPct(progress * 100);

            const frameIndex = Math.min(
                Math.floor(progress * TOTAL_FRAMES),
                TOTAL_FRAMES - 1
            );
            if (frameIndex !== currentFrameRef.current) {
                currentFrameRef.current = frameIndex;
                drawFrame(frameIndex, framesRef.current);
            }

            for (let i = PHASES.length - 1; i >= 0; i--) {
                if (progress >= PHASES[i].at) {
                    setPhase(i);
                    break;
                }
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, [framesLoaded]);

    return (
        <>
            {/* FIXED NAV */}
            <nav className="hero-nav">
                <div className="hero-nav-inner">
                    <div className="logo" onClick={() => setPage("landing")}>
                        <img src={logoImg} alt="Vakalat" style={{ height: 32, borderRadius: 6, objectFit: "contain" }} />
                        <span className="logo-mono" style={{ marginLeft: 10 }}>VAKA</span>
                        <span className="logo-sans">LAT</span>
                    </div>
                    <div className="hero-nav-links">
                        <span onClick={() => setPage("form")} className="hero-nav-link">
                            TRACK A CASE
                        </span>
                        <span className="hero-nav-link">HOW IT WORKS</span>
                        <span className="hero-nav-link">ABOUT</span>
                    </div>
                </div>
            </nav>

            {/* HERO OUTER — 300vh scroll room */}
            <div
                className="hero-outer"
                ref={containerRef}
                style={{ paddingTop: "64px" }}
            >
                <div className="hero-sticky">

                    {/* FULL-WIDTH ANIMATION BACKGROUND */}
                    <div className="hero-canvas-bg">
                        <div className="justice-glow" />
                        <div className="justice-stage">
                            {!framesLoaded && (
                                <div className="justice-loader">
                                    <span className="dot" />
                                    <span className="dot" />
                                    <span className="dot" />
                                </div>
                            )}
                            <canvas
                                ref={canvasRef}
                                width={1456}
                                height={816}
                                className="justice-canvas"
                            />
                        </div>

                        {/* Phase label */}
                        <div className="justice-phase">
                            <span className="phase-rule" />
                            <p className="phase-text">{phaseLabel}</p>
                            <span className="phase-rule" />
                        </div>

                        {/* Progress bar */}
                        <div className="justice-progress-bar">
                            <div
                                className="justice-progress-fill"
                                style={{ height: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* TEXT OVERLAY — sits on top of animation */}
                    <div className="hero-left">
                        <p className="hero-eyebrow">LEGAL CASE TRACKER — INDIA</p>

                        <h1 className="hero-h1">
                            Your case.<br />
                            Explained.<br />
                            <em>Finally.</em>
                        </h1>

                        <span className="hero-rule" />

                        <p className="hero-body">
                            eCourts data, decoded for real people. Enter your CNR number
                            and understand your case stage, hearing history, and what
                            justice is actually costing you.
                        </p>

                        <div className="hero-stat-block">
                            <p className="hero-stat-num">{statNum}</p>
                            <p className="hero-stat-label">{statLabel}</p>
                        </div>

                        <div className="hero-cta">
                            <button
                                className="btn-primary"
                                onClick={() => setPage("form")}
                            >
                                TRACK MY CASE →
                            </button>
                            <span className="btn-ghost">Free. No registration.</span>
                        </div>

                        <div className="hero-scroll-nudge">
                            <div className="nudge-line" />
                            <span className="nudge-text">Scroll to see justice delayed</span>
                        </div>

                        <div className="progress-dots">
                            {PHASES.map((_, i) => (
                                <div
                                    key={i}
                                    className={`pdot${activeDot === i ? " active" : ""}`}
                                />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}

