# ⚖️ Vakalat — Court Tracking for People, Not Lawyers

> *"Vakalat" (वकालत) — the act of advocacy in Indian law*

Vakalat is an open legal intelligence tool that turns India's opaque eCourts data into clear, actionable information for ordinary litigants. Enter your 16-character CNR number and instantly see your case history, who caused delays, what it's costing you, and exactly what to do before your next hearing.

---

## 🎯 The Problem

India has **46+ million pending cases**. Ordinary citizens navigating the process face:
- Court orders written in dense legal jargon
- No visibility into what "adjourned S/O" actually means
- No way to quantify the financial cost of each postponement
- Dependence on lawyers for even basic case status updates

## ✨ What Vakalat Does

| Feature | What it does |
|---|---|
| **Live Case Lookup** | Fetches real case data from eCourts.gov.in via CAPTCHA-solved scraping |
| **Hearing Timeline** | Visual history of every hearing — HEARD vs UNPRODUCTIVE (adjourned + unknown) |
| **Adjournment Cost Formula v3.2** | Calculates ₹ financial drain per adjournment using stage multipliers, fault attribution, and PLFS opportunity cost data |
| **Unproductive Rate** | Benchmarks your case's delay rate vs India's 61% national average (DAKSH Study) |
| **Questions for Your Lawyer** | AI-generated prep questions tailored to your case stage |
| **Pre-Hearing Prep Card** | Checklist of what to bring and verify before the next date |
| **Calendar & WhatsApp** | Add hearing to Google Calendar or share case summary via WhatsApp |

---

## 🛠️ Tech Stack

```
Frontend          React 19 + Vite
Backend           Node.js + Express
Scraping          Puppeteer (CAPTCHA bypass via pure HTTP session relay)
Database          Firebase Firestore (falls back to in-memory demo mode)
Data Sources      eCourts.gov.in, PLFS 2023-24, DAKSH India, DHCLSC Fee Schedule
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- A Firebase project (optional — demo mode works without it)

### 1. Clone the repo
```bash
git clone https://github.com/NavdeepSingh0/vakalat.git
cd vakalat
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in your values in .env
node server.js
# Runs at http://localhost:3000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5174
```

### 4. Environment Variables (`backend/.env`)
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```
> Firebase is optional. Without it, Vakalat runs fully in demo mode with pre-loaded cases.

---

## 📋 Demo Cases (no CAPTCHA needed)

| CNR | Case |
|---|---|
| `MHNA010000012019` | Priya Sharma vs. Rajesh Sharma — Family Court |
| `UPLU020000052020` | Ramesh Yadav vs. Suresh Yadav — Civil Dispute |
| `DLND030000032021` | Quick Solutions vs. Arjun Enterprises — Commercial |

---

## 📐 Adjournment Cost Formula

Vakalat uses a legally-grounded cost formula (v3.2) to quantify what each delay costs a litigant:

```
Total Cost = Σ (baseCost × stageMult × faultMult) + cumulativeEscalation

baseCost     = Lawyer fee + Travel + Opportunity cost (lost wages) + Incidentals
stageMult    = 0.60 (filing) → 1.25 (final arguments) — per Order XVII CPC & Ramrameshwari Devi (2011)
faultMult    = 1.00 (court) | 1.20 (opposite party) | 0.80 (own side) | 0.90 (mutual)
```

**Legal Basis:** CPC Order XVII Rules 1 & 2, Section 35/35A/35B CPC, Supreme Court in *Ramrameshwari Devi v. Nirmala Devi* (2011) 8 SCC 249

---

## 📊 Data & Research Citations

- **Adjournment Rate Benchmark:** DAKSH India & Vidhi Centre for Legal Policy — 61% of hearings are unproductive
- **Opportunity Cost Rates:** PLFS Annual Report July 2023–June 2024 (MoSPI/NSO), 75th percentile
- **Lawyer Fee Baseline:** DHCLSC Fee Schedule w.e.f. 1 July 2024 + Law Ministry Panel Counsel Rates, February 2026
- **Travel Costs:** MGNREGA Schedule 2024-25

---

## 🏗️ Project Structure

```
vakalat/
├── backend/
│   ├── server.js              # Express API + all routes
│   ├── services/ecourts.js    # eCourts scraper (Puppeteer + HTTP)
│   ├── routes/pdfRoutes.js    # Court order PDF download & parse
│   ├── data/
│   │   ├── demo-cases.js      # Seeded demo case data
│   │   └── ecourts-codes.json # Purpose code → plain English map
│   └── config/firebase.js     # Firebase Admin init
└── frontend/
    └── src/
        ├── components/
        │   ├── LandingPage.jsx
        │   ├── FormPage.jsx        # CNR input + CAPTCHA
        │   ├── CaseDashboard.jsx   # Main dashboard
        │   └── Shared.jsx          # Design system components
        ├── adjournmentFormula.js   # Cost formula v3.2
        ├── utils.js                # normalizeCaseData, useReveal, etc.
        └── services/api.js         # Frontend API client
```

---

## ⚡ API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/case/:cnr` | GET | Fetch case from demo store or live cache |
| `/api/case/cnr/live` | POST | Live lookup via eCourts + CAPTCHA |
| `/api/case/:cnr/questions` | GET | AI-generated lawyer questions |
| `/api/case/:cnr/prep` | GET | Pre-hearing preparation checklist |
| `/api/case/:cnr/hearings` | GET | Classified hearing history |
| `/api/captcha` | GET | Fetch CAPTCHA from eCourts |
| `/api/translate` | GET | Translate eCourts purpose code → plain English |

---

## 🤝 Built at Hack-N-Win 2025

Vakalat was built as a submission for the Hack-N-Win hackathon with the goal of democratizing access to legal information in India.

---

## 📄 License

MIT — Use it, fork it, improve it. Justice shouldn't be paywalled.
