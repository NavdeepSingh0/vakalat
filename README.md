# ⚖️ Vakalat — Court tracking for people, not lawyers

> *"Vakalat" (वकालत) — the act of advocacy in Indian law*

Vakalat turns eCourts case data into plain English for ordinary litigants. Enter your 16-character **CNR** and see where your case stands, what each hearing actually meant, what the adjournments may have cost, and what to ask your lawyer before the next date.

It is a full-stack project: a **React** single-page app, a **Node/Express** API that talks to the eCourts portal, an adjournment **cost model**, an optional **Gemini**-powered order reader, and optional **Firestore** persistence.

> Vakalat is not a law firm and does not give legal advice. Hearing status and cost figures are **estimates** built from short court entries and assumed fee tables.

---

## 🎯 Why

India has roughly **4.76 crore (47.6 million) cases pending** across its courts (Government reply to Parliament, data as of Dec 2025), including **81,275 district-court cases pending for more than 30 years** (Rajya Sabha reply, 2026). Court records are written for lawyers; the people they describe are left guessing what "NNFR" or "S/O" means. A 2016 DAKSH time-and-motion study of Bengaluru courts found adjournments took about **54% of civil-court sitting time**.

Sources: [IANS on the Lok Sabha reply](https://ianslive.in/over-476-crore-cases-pending-across-indian-courts-govt-tells-parliament--20260213184542) · [Bar & Bench on the Rajya Sabha reply](https://www.barandbench.com/news/26-cases-pending-in-supreme-court-for-30-years-558-cases-for-20-years-centre-in-rajya-sabha) · [DAKSH study](https://dakshindia.org/wp-content/uploads/2016/11/DAKSH-TIME-AND-MOTION-STUDY-OF-FOUR-DISTRICT-AND-SESSIONS-COURTS.pdf)

## ✨ Features

| Feature | What it does |
|---|---|
| **Live case lookup** | Fetches a case from the eCourts portal. *You* solve the CAPTCHA; Vakalat relays it and reads the result. District courts and High Courts. |
| **Case stage tracker** | Shows which of 8 stages the case is in, with general average durations for what comes next. |
| **Plain-English hearings** | Translates court codes (`NNFR`, `WS`, `PE`…) and marks each hearing **heard / adjourned / unclear / outcome**. Anything ambiguous is "unclear" — never guessed. |
| **Financial drain calculator** | Estimates the cost of *confirmed* adjournments, weighted by the stage at that time and by who caused it. Computed once, in the backend. |
| **Questions for your lawyer** | Five suggested questions per stage, each with a short "why it matters". Static, not AI-generated. |
| **Order reader** | Opens a court order PDF, extracts the text and (with a Gemini key) summarises it: what happened, what each side must do, key dates. |
| **Pre-hearing prep card** | Countdown to the next date, tick-off checklist, what to expect at this stage. |
| **Long-pending alert** | Flags cases older than a reference timeline (civil 3 yrs / criminal 1 yr — Vakalat's own rule of thumb, **not** a legal deadline). |
| **Calendar & WhatsApp** | Google Calendar link, `.ics` download, WhatsApp share. Every case has a shareable URL (`/case/<CNR>`). |

---

## 🏗️ Architecture

```
┌───────────────┐   /api    ┌────────────────────────────────────┐        ┌──────────────┐
│ React + Vite  │ ────────▶ │ Express API                        │ ─────▶ │ eCourts      │
│ react-router  │ ◀──────── │  routes → services → case store    │  HTTP  │ portal       │
└───────────────┘   JSON    │  classifier · parser · cost model  │        └──────────────┘
                            │  order service ──▶ Gemini (opt.)   │
                            │  case store ──▶ Firestore (opt.)   │
                            └────────────────────────────────────┘
```

```
backend/
  app.js · server.js            createApp() (testable) + process entry
  config/                       env.js (validated config) · firebase.js (optional)
  middleware/                   errorHandler · rateLimit · validate
  routes/                       caseRoutes · ecourtsRoutes · orderRoutes · translateRoutes
  services/
    ecourts/                    client (HTTP + sessions) · parser · classifier · dates
    caseStore.js                demo + live cases, TTL, optional Firestore write-through
    costModel.js                the adjournment cost model (single source of truth)
    orderService.js · gemini.js · simplePdf.js · firestorePersistence.js · logger.js
  data/                         demo-cases · demo-orders · stage-questions · ecourts-codes.json
  test/                         node:test suites + fixtures
frontend/src/
  components/                   LandingPage · FormPage · CaseDashboard · dashboard/* · HeroSection
  services/api.js · utils.js · calendar.js · styles/
```

**Hearing order invariant:** the API always returns hearings oldest-first with ISO (`YYYY-MM-DD`) dates; the UI sorts newest-first for display.

---

## 🚀 Local setup

**Prerequisites:** Node.js 20+ (CI uses 22). Nothing else is required — demo mode works without Firebase or an API key.

```bash
git clone https://github.com/NavdeepSingh0/vakalat.git
cd vakalat

# 1. API  → http://localhost:3000
cd backend
npm install
cp .env.example .env      # optional: add GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH…
npm run dev

# 2. Web app  → http://localhost:5173  (proxies /api to :3000)
cd ../frontend
npm install
npm run dev
```

### Environment (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated browser origins allowed to call the API |
| `CASE_CACHE_TTL_MIN` | `30` | Minutes a live case (and its eCourts session) stays in memory |
| `GEMINI_API_KEY` | *(empty)* | Enables AI summaries of live orders. Without it demo orders still work (pre-written samples) and live ones return `503 ai_unavailable` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Override if Google retires the model id |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | *(empty)* | Path to a service-account JSON → enables Firestore persistence |
| `RATE_LIMIT_*`, `TRUST_PROXY`, `LOG_LEVEL`, `NODE_ENV` | see `.env.example` | Hardening and logging |

Frontend: `VITE_API_URL` only if the API is hosted on a different origin (see `frontend/.env.example`).

### Tests and checks

```bash
cd backend  && npm run lint && npm test          # node:test — 60+ tests
cd frontend && npm run lint && npm test && npm run build   # Vitest + Testing Library
```
CI (`.github/workflows/ci.yml`) runs lint, tests, build and `npm audit --omit=dev --audit-level=high` for both packages.

---

## 📋 Demo cases (fictional — no CAPTCHA needed)

| CNR | Case |
|---|---|
| `MHNA010000012019` | Priya Sharma vs. Rajesh Sharma — civil / property |
| `UPLU020000052020` | Ramesh Yadav vs. Suresh Yadav — land boundary |
| `DLND030000032021` | M/s Quick Solutions vs. Arjun Enterprises — commercial |
| `TNCH040000082018` | Lakshmi Ammal vs. Kannan — rent control |
| `MHPU050000072022` | Vikram Desai vs. State of Maharashtra — criminal |

Next-hearing dates are generated relative to today. Six hearings have sample orders for the order reader.

---

## ⚡ API reference

All routes are under `/api`. Errors are JSON `{ "error": "<code>", "message": "…" }` — never stack traces. CNRs are 4 letters + 12 digits.

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Status, persistence mode (`memory`/`firestore`), AI availability |
| `/demo-cases` | GET | The five demo cases |
| `/captcha?courtType=district\|highcourt` | GET | Fetch an eCourts CAPTCHA (rate-limited) |
| `/case/cnr/live` | POST | `{ cnr, captcha, sessionId }` → live lookup; stores the case for the cache TTL |
| `/case/:cnr` | GET | Case (demo or live-cached) with `hearingStats` |
| `/case/:cnr/hearings` | GET | Hearings + stats (heard / adjourned / unclear / disposed) |
| `/case/:cnr/stage` | GET | Stage list with status and average months |
| `/case/:cnr/questions` | GET | Stage questions `{q, why}` + contextual ones |
| `/case/:cnr/prep` | GET | Checklist, days until next hearing |
| `/case/:cnr/whatsapp` | GET | Share message + `wa.me` link |
| `/case/:cnr/summary` | GET | Compact summary incl. estimated cost at default assumptions |
| `/case/:cnr/cost` | POST | `{ seniorFeePerHearing, workerType, travelMode, juniorCount? }` → cost breakdown |
| `/cost-config` | GET | Worker types, travel modes, defaults, limits |
| `/case/search` | POST | `{ type: "party"\|"advocate", query }` — **demo cases only** |
| `/order/:cnr/:hearingId/download` | GET | Order PDF |
| `/order/:cnr/:hearingId/text` | GET | Extracted text |
| `/order/:cnr/:hearingId/summary` | GET | Plain-English summary (+ `/actions`) |
| `/translate?code=` , `/translate/all` | GET | eCourts purpose/stage code → plain English |

Order routes take **no query parameters**: the server looks the order up in its own case store, and the download host is chosen from an allow-list (`services.ecourts.gov.in` / `hcservices.ecourts.gov.in`), never from client input.

---

## 📐 Adjournment cost model (v3.3)

Implemented in `backend/services/costModel.js`; the UI only collects inputs.

```
weightedCost = baseCost × stageMultiplier × faultMultiplier
baseCost     = professional fees + travel/stay + lost earnings + incidentals
```

| | Values |
|---|---|
| **Stage multiplier** | filing/admission 0.60 · notice 0.75 · interlocutory 0.90 · evidence 1.00 (baseline) · final arguments 1.50 · order reserved 1.80 |
| **Fault multiplier** | court/system 1.00 · other side 1.20 (potentially recoverable) · own side 0.50 · mutual 0.75 · cause not recorded 1.00 |
| **Lost earnings / day** | casual labour ₹550 · skilled informal ₹1,100 · salaried ₹1,800 · small self-employed ₹4,500 · professional ₹7,500 · corporate officer ₹20,000 · senior executive ₹50,000 |
| **Travel / hearing** | local ₹500 · outstation ₹2,000 + ₹3,000 hotel · intercity ₹6,000 + ₹5,000 hotel |

Each adjournment is charged at the stage the case was in **at that hearing** (not today's stage). Only **confirmed** adjournments are costed; "unclear" hearings are reported separately. The user's fee is treated as the total for their counsel (extra juniors are opt-in, ⅔ of the fee capped at ₹15,000). Legal context: CPC Order XVII Rules 1–2, ss. 35/35A/35B, *Ramrameshwari Devi v. Nirmala Devi* (2011) 8 SCC 249. Fee and wage tables are **assumptions** (inspired by DHCLSC fee schedules, PLFS 2023-24 and MGNREGA wages) — replace them with your actual figures.

---

## 🔒 Privacy, limits and responsible use

- No accounts, no analytics. Live cases are held **in server memory for ~30 minutes** and are not written to disk. If the operator enables Firestore, case snapshots (with a TTL field) and order summaries are stored there.
- Logs never contain CNRs, CAPTCHA text or cookies (the access log records route patterns such as `/case/:cnr`).
- Order text is sent to Google's Gemini API **only** when a key is configured and a user opens a live order; the CNR and party names are not sent separately.
- **Scraping:** the app relays a CAPTCHA that the *user* solves, rate-limits itself, and makes one case lookup per request. Check the eCourts portal's terms of use before running a public instance.
- **Accuracy:** hearing status is inferred from one-line court entries and can be wrong; the assumed side is the petitioner/plaintiff. Nothing here is legal advice.
- The live eCourts path depends on the portal's current markup; the parser is covered by tests against a synthetic fixture, not the live site.

## 📄 License

MIT — see [LICENSE](LICENSE).
