import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteNav, Footer } from './Shared';
import { useDocumentTitle, useReveal } from '../utils';
import HeroSection from './HeroSection';

// Every figure on this page is sourced; see SOURCES. Unverifiable numbers were removed.
const SOURCES = [
    ['Cases pending (4.76 crore, Dec 2025)', 'https://ianslive.in/over-476-crore-cases-pending-across-indian-courts-govt-tells-parliament--20260213184542'],
    ['Cases pending 30+ years (district courts)', 'https://www.barandbench.com/news/26-cases-pending-in-supreme-court-for-30-years-558-cases-for-20-years-centre-in-rajya-sabha'],
    ['DAKSH time-and-motion study (2016)', 'https://dakshindia.org/wp-content/uploads/2016/11/DAKSH-TIME-AND-MOTION-STUDY-OF-FOUR-DISTRICT-AND-SESSIONS-COURTS.pdf'],
];

const STEPS = [
    { num: 'STEP 01', title: 'Enter Your CNR', body: 'Your Case Number Record (CNR) is the 16-character identifier printed on court notices and filing receipts.', code: 'MHNA010000012019' },
    { num: 'STEP 02', title: 'We Fetch Live Data', body: 'Vakalat asks the eCourts portal for your case — you solve the CAPTCHA, we read the result. Nothing is guessed.' },
    { num: 'STEP 03', title: 'Read Plain English', body: "Court records are full of codes like 'PE', 'NNFR', 'WS'. Vakalat translates them into sentences your family can understand." },
];

const FEATURES = [
    ['01', 'Case Stage Tracker', "See where your case sits in the 8-stage court process, with general averages for what usually comes next."],
    ['02', 'Plain-English Hearings', "Court records use codes like 'NNFR', 'WS', 'PE'. We translate each hearing into a plain sentence and mark it heard, adjourned or unclear."],
    ['03', 'Financial Drain Calculator', 'Enter your lawyer’s fee, your daily earnings and travel. Vakalat estimates what confirmed adjournments may have cost, stage by stage.'],
    ['04', 'Questions for Your Lawyer', 'Five suggested questions for your case stage, each with a short explanation of why it matters.'],
    ['05', 'Order Reader', 'Open a court order and get a plain-English summary, what each side must do, and the dates to watch — alongside the original PDF.'],
    ['06', 'Pre-Hearing Prep Card', 'A countdown to your next hearing, a checklist you can tick off, and what to expect at your stage.'],
    ['07', 'Long-Pending Alert', 'If a case has been pending longer than our reference timeline, we point to the rights and options worth asking your lawyer about.'],
    ['08', 'Add to Calendar', 'One click to add your next hearing to Google Calendar or download an .ics file.'],
];

function CountUp({ to, decimals = 2, suffix = '' }) {
    const ref = useRef(null);
    const [value, setValue] = useState(to.toFixed(decimals)); // final value is the default (no-JS / reduced-motion safe)
    useEffect(() => {
        const el = ref.current;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!el || reduce || typeof IntersectionObserver === 'undefined') return undefined;
        let raf;
        const obs = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            obs.disconnect();
            const t0 = performance.now();
            const step = (now) => {
                const p = Math.min((now - t0) / 1600, 1);
                setValue(((1 - Math.pow(1 - p, 3)) * to).toFixed(decimals));
                if (p < 1) raf = requestAnimationFrame(step);
            };
            setValue((0).toFixed(decimals));
            raf = requestAnimationFrame(step);
        }, { threshold: 0.3 });
        obs.observe(el);
        return () => { obs.disconnect(); cancelAnimationFrame(raf); };
    }, [to, decimals]);
    return <span ref={ref}>{value}{suffix}</span>;
}

export default function LandingPage() {
    useDocumentTitle('');
    useReveal();

    return (
        <div style={{ background: 'var(--ink-100)' }}>
            <SiteNav />
            <main id="main">
                <HeroSection />

                {/* STATS BAND */}
                <section className="pad-x dark" aria-label="Key figures" style={{ background: 'var(--ink-100)', padding: '40px var(--gutter)' }}>
                    <div className="container stats-band">
                        {[
                            [<CountUp key="a" to={4.76} suffix=" Crore" />, 'cases pending in Indian courts (Dec 2025)'],
                            ['≈54%', 'of civil court sitting time spent on adjournments (Bengaluru study, 2016)'],
                            ['81,275', 'district-court cases pending for 30+ years'],
                        ].map(([num, label], i) => (
                            <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                                <p className="mono" style={{ fontWeight: 600, color: '#fff', fontSize: 'clamp(2rem,4vw,3rem)' }}>{num}</p>
                                <p style={{ color: 'var(--ink-30)', fontSize: '0.875rem', marginTop: 8, lineHeight: 1.5 }}>{label}</p>
                            </div>
                        ))}
                    </div>
                    <p className="container mono" style={{ color: 'var(--ink-50)', fontSize: '0.7rem', marginTop: 24, textAlign: 'center' }}>
                        Sources:{' '}
                        {SOURCES.map(([label, href], i) => (
                            <span key={href}>{i > 0 && ' · '}<a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{label}</a></span>
                        ))}
                    </p>
                </section>

                {/* HOW IT WORKS */}
                <section id="how-it-works" className="section light" style={{ background: 'var(--ink-04)', color: 'var(--ink-90)' }} aria-labelledby="how-title">
                    <div className="container">
                        <p data-reveal className="eyebrow" style={{ fontSize: '0.7rem', letterSpacing: '0.18em' }}>THE PROCESS</p>
                        <span data-reveal data-delay="1" className="line-wipe" style={{ marginTop: 16 }} />
                        <h2 id="how-title" data-reveal data-delay="2" className="serif" style={{ fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2.1rem)', color: 'var(--ink-100)', maxWidth: 540, margin: '16px 0 48px' }}>
                            Three steps from confusion to clarity.
                        </h2>
                        <div className="grid-3">
                            {STEPS.map((step, i) => (
                                <div key={step.num} data-reveal data-delay={`${i + 1}`} style={{ background: i === 1 ? 'var(--ink-00)' : 'var(--ink-04)', padding: '40px 32px' }}>
                                    <p className="mono eyebrow" style={{ letterSpacing: '0.16em' }}>{step.num}</p>
                                    <div style={{ borderTop: '1px solid var(--ink-15)', margin: '16px 0' }} />
                                    <h3 className="serif" style={{ fontWeight: 700, fontSize: '1.375rem', color: 'var(--ink-100)', lineHeight: 1.2 }}>{step.title}</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-70)', lineHeight: 1.7, marginTop: 12 }}>{step.body}</p>
                                    {step.code && <p className="mono dark" style={{ background: 'var(--ink-100)', color: '#fff', padding: '10px 16px', marginTop: 16, fontSize: '0.875rem' }}>{step.code}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* THE PROBLEM */}
                <section className="section dark" style={{ background: 'var(--ink-100)' }} aria-label="Why Vakalat exists">
                    <div className="container problem-grid">
                        <div data-reveal>
                            <p className="eyebrow" style={{ color: 'var(--ink-30)', letterSpacing: '0.18em', marginBottom: 24 }}>WHY THIS EXISTS</p>
                            <p className="serif" style={{ fontStyle: 'italic', fontSize: 'clamp(1.6rem,3.5vw,2.6rem)', color: '#fff', lineHeight: 1.2 }}>
                                Court records are written for lawyers. Vakalat translates them for the people whose lives they describe.
                            </p>
                        </div>
                        <div data-reveal data-delay="2">
                            {[['4.76 Crore', 'cases pending across Indian courts'], ['81,275', 'district-court cases pending for more than 30 years'], ['≈54%', 'of civil court sitting time spent on adjournments in one study']].map(([num, label], i) => (
                                <div key={num}>
                                    <p className="mono" style={{ fontWeight: 600, color: '#fff', fontSize: '2.2rem' }}>{num}</p>
                                    <p style={{ color: 'var(--ink-30)', fontSize: '0.875rem', marginTop: 4, maxWidth: 260, lineHeight: 1.5 }}>{label}</p>
                                    {i < 2 && <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '24px 0' }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FEATURES */}
                <section className="section" style={{ background: 'var(--ink-00)', color: 'var(--ink-90)' }} aria-labelledby="features-title">
                    <div className="container">
                        <p data-reveal className="eyebrow" style={{ fontSize: '0.7rem', letterSpacing: '0.18em' }}>FEATURES</p>
                        <span data-reveal data-delay="1" className="line-wipe" style={{ marginTop: 16 }} />
                        <h2 id="features-title" data-reveal data-delay="2" className="serif" style={{ fontWeight: 700, fontSize: 'clamp(1.5rem,2.5vw,2.1rem)', color: 'var(--ink-100)', maxWidth: 600, margin: '16px 0 48px' }}>
                            What your lawyer sees. Now you can too.
                        </h2>
                        <div className="features-grid">
                            {FEATURES.map(([num, title, body], i) => (
                                <div key={num} className="feature-cell" data-reveal data-delay={`${Math.min(i + 1, 4)}`}>
                                    <p className="mono eyebrow" style={{ letterSpacing: '0.14em' }}>{num}</p>
                                    <div style={{ borderTop: '1px solid var(--ink-15)', margin: '16px 0' }} />
                                    <h3 className="serif" style={{ fontWeight: 700, fontSize: '1.375rem', color: 'var(--ink-100)' }}>{title}</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-70)', lineHeight: 1.7, marginTop: 12 }}>{body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ABOUT / TRUST */}
                <section id="about" className="section dark" style={{ background: 'var(--ink-100)' }} aria-labelledby="about-title">
                    <div className="container">
                        <h2 id="about-title" className="eyebrow" style={{ color: 'var(--ink-30)', letterSpacing: '0.18em', marginBottom: 24 }}>ABOUT VAKALAT</h2>
                        <div className="grid-3" style={{ background: 'var(--ink-50)' }}>
                            {[
                                ['SOURCE', 'Case data is fetched from the eCourts portal operated by the Government of India. Accuracy depends on what the court has entered.'],
                                ['PRIVACY', 'No accounts and no tracking. A live case is held in the server’s memory for about 30 minutes and is not written to disk (unless the operator enables optional storage). CNR numbers are kept out of the logs.'],
                                ['LIMITS', 'Hearing status and cost figures are estimates based on short court entries and assumed fee tables. Vakalat is not a law firm and does not give legal advice.'],
                            ].map(([label, text], i) => (
                                <div key={label} className="light" data-reveal data-delay={`${i + 1}`} style={{ background: 'var(--ink-04)', color: 'var(--ink-100)', padding: 'clamp(24px,4vw,40px)' }}>
                                    <p className="eyebrow">{label}</p>
                                    <p className="serif" style={{ fontSize: '1.05rem', lineHeight: 1.55, marginTop: 16 }}>{text}</p>
                                </div>
                            ))}
                        </div>
                        <p style={{ color: 'var(--ink-30)', fontSize: '0.9rem', marginTop: 32, lineHeight: 1.7, maxWidth: 720 }}>
                            Vakalat is free, open source (MIT) and built as a full-stack project: a React front end, a Node/Express API that talks to eCourts, and an optional Gemini-powered order reader.
                        </p>
                        <div style={{ marginTop: 32 }}><Link to="/track" className="btn btn-light">Track a case →</Link></div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
