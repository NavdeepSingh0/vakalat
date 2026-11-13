import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.jpeg';

/** Scrolls to the top on navigation, or to the #anchor when the URL has one. */
export function ScrollManager() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (hash) {
            const id = decodeURIComponent(hash.slice(1));
            const t = setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView();
            }, 0);
            return () => clearTimeout(t);
        }
        window.scrollTo(0, 0);
        return undefined;
    }, [pathname, hash]);
    return null;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────
const TAG_BASE = {
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em',
    textTransform: 'uppercase', padding: '4px 10px', borderRadius: 2, display: 'inline-block',
};
const TAG_VARIANTS = {
    dark: { background: 'var(--ink-100)', color: '#fff' },
    outline: { background: 'transparent', color: 'var(--ink-70)', border: '1px solid var(--ink-30)' },
    'white-outline': { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' },
    muted: { background: 'var(--ink-08)', color: 'var(--ink-70)' },
};

export const Tag = ({ children, variant = 'dark', style = {} }) => (
    <span style={{ ...TAG_BASE, ...(TAG_VARIANTS[variant] || TAG_VARIANTS.muted), ...style }}>{children}</span>
);

// ─── Brand + nav ─────────────────────────────────────────────────────────────
export const Brand = ({ imgHeight = 32 }) => (
    <Link to="/" className="brand" aria-label="Vakalat — home">
        <img src={logoImg} alt="" style={{ height: imgHeight }} />
        <span><span className="brand-mono">VAKA</span><span className="brand-sans">LAT</span></span>
    </Link>
);

export const SiteNav = ({ variant = 'landing' }) => (
    <nav className="site-nav dark" aria-label="Main">
        <div className="site-nav-inner">
            <Brand />
            <div className="nav-links">
                {variant === 'caseview' && <Link to="/track" className="nav-link subtle ul-link keep">← Track another</Link>}
                <Link to="/track" className="nav-link ul-link keep">Track a case</Link>
                <Link to="/#how-it-works" className="nav-link ul-link">How it works</Link>
                <Link to="/#about" className="nav-link ul-link">About</Link>
            </div>
        </div>
    </nav>
);

// ─── Footer ──────────────────────────────────────────────────────────────────
const EXTERNAL = [
    ['eCourts Services', 'https://services.ecourts.gov.in/'],
    ['National Judicial Data Grid', 'https://njdg.ecourts.gov.in/'],
    ['DAKSH', 'https://dakshindia.org/'],
];

export const Footer = () => (
    <footer className="site-footer dark">
        <div className="container">
            <div className="footer-grid">
                <div>
                    <div style={{ marginBottom: 16 }}><Brand imgHeight={40} /></div>
                    <p style={{ color: 'var(--ink-50)', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: 280 }}>
                        Making the Indian courts system legible for families who deserve to understand what is happening to their cases.
                    </p>
                </div>
                <nav aria-label="Product">
                    <p className="footer-heading">Product</p>
                    <Link to="/track" className="footer-link">Track a case</Link>
                    <Link to="/#how-it-works" className="footer-link">How it works</Link>
                    <Link to="/track#demo" className="footer-link">Demo cases</Link>
                </nav>
                <nav aria-label="Data sources">
                    <p className="footer-heading">Data &amp; sources</p>
                    {EXTERNAL.map(([label, href]) => (
                        <a key={href} href={href} className="footer-link" target="_blank" rel="noopener noreferrer">{label}</a>
                    ))}
                </nav>
                <div>
                    <p className="footer-heading">Legal</p>
                    <p style={{ color: 'var(--ink-50)', fontSize: '0.75rem', lineHeight: 1.8 }}>
                        Vakalat is not a law firm and does not provide legal advice. Data comes from public court records and may be incomplete or out of date.
                        Not affiliated with the Government of India or NIC.
                    </p>
                </div>
            </div>
            <div className="footer-bottom">
                <span className="mono" style={{ color: 'var(--ink-50)', fontSize: '0.75rem' }}>© 2026 VAKALAT · MIT LICENSE</span>
                <span className="mono" style={{ color: 'var(--ink-50)', fontSize: '0.75rem' }}>DATA: ECOURTS.GOV.IN</span>
            </div>
        </div>
    </footer>
);
