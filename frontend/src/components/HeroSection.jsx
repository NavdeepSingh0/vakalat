import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './HeroSection.css';

// Frames: public/frames/ezgif-frame-001.jpg → ezgif-frame-067.jpg
const TOTAL_FRAMES = 67;
const FRAME_PATH = (i) => `/frames/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;

// Figures are sourced — see the landing page "Sources" line. Phase 4 is Vakalat's own message.
const PHASES = [
    { at: 0, phaseLabel: 'BALANCED — SCALES OF JUSTICE', statNum: '4.76 Cr', statLabel: 'cases pending in Indian courts (Govt. reply to Parliament, Dec 2025)' },
    { at: 0.28, phaseLabel: 'THE WEIGHT OF DELAY', statNum: '~54%', statLabel: 'of civil court sitting time spent on adjournments in a DAKSH study of Bengaluru courts (2016)' },
    { at: 0.58, phaseLabel: 'THE SWORD LOWERS', statNum: '81,275', statLabel: 'district-court cases pending for more than 30 years (Govt. reply to Rajya Sabha, 2026)' },
    { at: 0.82, phaseLabel: 'KNOW WHERE YOU STAND', statNum: '8 stages', statLabel: 'from filing to judgment — Vakalat shows which one your case is in' },
];

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroSection() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const framesRef = useRef(new Array(TOTAL_FRAMES).fill(null)); // Image | null (null = not loaded / failed)
    const currentFrameRef = useRef(0);
    const phaseRef = useRef(0);

    const [firstFrameReady, setFirstFrameReady] = useState(false);
    const [phase, setPhase] = useState(0);
    const [progressPct, setProgressPct] = useState(0);

    // Draw the nearest loaded frame at or before `index` (so a slow/failed frame never leaves a blank canvas).
    const drawFrame = (index) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        for (let i = index; i >= 0; i--) {
            const img = framesRef.current[i];
            if (img) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                return;
            }
        }
    };

    // Frame 1 first (so the hero shows immediately), the rest in the background.
    useEffect(() => {
        let cancelled = false;
        const load = (i) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { if (!cancelled) framesRef.current[i] = img; resolve(); };
            img.onerror = () => resolve();
            img.src = FRAME_PATH(i + 1);
        });
        (async () => {
            await load(0);
            if (cancelled) return;
            drawFrame(0);
            setFirstFrameReady(true);
            if (prefersReducedMotion()) return; // static hero: the first frame is enough
            for (let i = 1; i < TOTAL_FRAMES; i += 4) {
                await Promise.all([i, i + 1, i + 2, i + 3].filter((n) => n < TOTAL_FRAMES).map(load));
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Scroll scrubbing (rAF-throttled). Skipped entirely for reduced motion.
    useEffect(() => {
        if (prefersReducedMotion()) return undefined;
        let ticking = false;
        const update = () => {
            ticking = false;
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const scrollable = container.offsetHeight - window.innerHeight;
            const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
            setProgressPct(progress * 100);

            const frameIndex = Math.min(Math.floor(progress * TOTAL_FRAMES), TOTAL_FRAMES - 1);
            if (frameIndex !== currentFrameRef.current) {
                currentFrameRef.current = frameIndex;
                drawFrame(frameIndex);
            }
            for (let i = PHASES.length - 1; i >= 0; i--) {
                if (progress >= PHASES[i].at) {
                    if (phaseRef.current !== i) { phaseRef.current = i; setPhase(i); }
                    break;
                }
            }
        };
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        update();
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
    }, []);

    const p = PHASES[phase];

    return (
        <div className="hero-outer dark" ref={containerRef}>
            <div className="hero-sticky">
                <div className="hero-canvas-bg" aria-hidden="true">
                    <div className="justice-glow" />
                    <div className="justice-stage">
                        {!firstFrameReady && <div className="justice-loader"><span className="dot" /><span className="dot" /><span className="dot" /></div>}
                        <canvas ref={canvasRef} width={1456} height={816} className="justice-canvas" />
                    </div>
                    <div className="justice-phase">
                        <span className="phase-rule" />
                        <p className="phase-text">{p.phaseLabel}</p>
                        <span className="phase-rule" />
                    </div>
                    <div className="justice-progress-bar"><div className="justice-progress-fill" style={{ height: `${progressPct}%` }} /></div>
                </div>

                <div className="hero-left">
                    <p className="hero-eyebrow">LEGAL CASE TRACKER — INDIA</p>
                    <h1 className="hero-h1">Your case.<br />Explained.<br /><em>Finally.</em></h1>
                    <span className="hero-rule" />
                    <p className="hero-body">
                        eCourts data, decoded for real people. Enter your CNR number and understand your case stage, hearing history, and what the delays may be costing you.
                    </p>

                    <div className="hero-stat-block" aria-live="off">
                        <p className="hero-stat-num">{p.statNum}</p>
                        <p className="hero-stat-label">{p.statLabel}</p>
                    </div>

                    <div className="hero-cta">
                        <Link className="btn-primary" to="/track">TRACK MY CASE →</Link>
                        <span className="btn-ghost">Free. No registration.</span>
                    </div>

                    <div className="hero-scroll-nudge" aria-hidden="true">
                        <div className="nudge-line" />
                        <span className="nudge-text">Scroll to see justice delayed</span>
                    </div>
                    <div className="progress-dots" aria-hidden="true">
                        {PHASES.map((_, i) => <div key={i} className={`pdot${phase === i ? ' active' : ''}`} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
