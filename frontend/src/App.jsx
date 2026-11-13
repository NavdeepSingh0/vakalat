import { Link, Route, Routes } from 'react-router-dom';
import { Footer, ScrollManager, SiteNav } from './components/Shared';
import { useDocumentTitle } from './utils';
import LandingPage from './components/LandingPage';
import FormPage from './components/FormPage';
import CaseDashboard from './components/CaseDashboard';

function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteNav />
      <main id="main" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <p className="eyebrow">404</p>
          <h1 className="serif" style={{ fontSize: '2rem', margin: '12px 0 24px' }}>This page does not exist.</h1>
          <Link to="/track" className="btn">Track a case</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/track" element={<FormPage />} />
        <Route path="/case/:cnr" element={<CaseDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
