# Vakalat — Repo Audit

> **Status (branch `fix/audit-remediation`):** every item below has been addressed — see [Resolution status](#resolution-status) at the end. The findings are kept as written for the record.

Audited 2026-11-13 at commit `f4425ef` (master). Method: read every source file, then ran `npm ci`, `eslint`, `vite build`, `npm audit`, started the backend and probed endpoints. Items marked **[verified]** were reproduced by running code; the rest come from reading it.

**Bottom line:** the demo path (landing → demo case → dashboard) works, and the frontend builds. For a "full stack project" presentation, the main risks are (1) claims in the README and UI that the code does not back up, (2) a few real security holes in the backend, and (3) a live-lookup path that is partly broken or untested.

---

## 🔴 Fix before presenting

### Security
| # | Issue | Where | Notes |
|---|---|---|---|
| S1 | **SSRF** — the PDF routes accept a client-supplied `pdfUrl` and the host inside it is used as the request target. **[verified]** Backend made POST + GET requests to a local listener I supplied. | `backend/routes/pdfRoutes.js:63-75, 195-199` | Never trust the host from the client. Look the URL up server-side, or allow-list `services.ecourts.gov.in` / `hcservices.ecourts.gov.in`. |
| S2 | **Unauthenticated `DELETE /api/case/cache/:cnr`**; anyone can call it. | `backend/server.js:144-150` | Remove, or protect it. See also bug B1 — it does not do what it claims. |
| S3 | **Stack traces and local file paths leak** on bad input (Express default error handler). **[verified]** `POST /api/case/:cnr/drain` with no JSON body returns an HTML page with `C:\Projects\vakalat\backend\server.js:240`. | `backend/server.js:240` | Add a final error-handling middleware, set `NODE_ENV=production`, default `req.body ?? {}`. |
| S4 | **Gemini API key in the URL query string** (ends up in logs, proxies, error messages). | `pdfRoutes.js:504` | Send it in the `x-goog-api-key` header, or use the already-installed `@google/genai` SDK. |
| S5 | **No rate limiting; `cors()` allows every origin.** **[verified]** `Access-Control-Allow-Origin: *`. `/api/captcha` makes 3 outbound requests to eCourts per call, so the backend can be used to hammer a government site. | `server.js:21`, `:86` | `express-rate-limit`, restrict CORS to the frontend origin. |
| S6 | **Dependency vulnerabilities:** `npm audit --omit=dev` reports **45 (3 critical, 21 high)** in the backend. Nearly all come from `puppeteer*`, which the code never uses (see C1). | `backend/package.json` | Removing the unused packages likely clears most of this. |
| S7 | Debug dumps of real case data written to disk on every live lookup (`last_ecourts_response.json/.html`); CNR + CAPTCHA + session cookies are `console.log`ged. Files are gitignored, but they are PII on the server. | `services/ecourts.js:217-228, 259-284` | Remove, or gate behind `DEBUG`. |

### Claims that are false or misleading (will be noticed in a demo/viva)
| # | Claim | Reality |
|---|---|---|
| C1 | README: "Scraping — **Puppeteer** (CAPTCHA bypass …)" | `ecourts.js` is pure HTTP (axios + cheerio); Puppeteer is never imported. `server.js:9` imports a `closeBrowser` that doesn't exist. And the user solves the CAPTCHA, so "bypass" is the wrong word — say "CAPTCHA relay". |
| C2 | README: "Database — **Firebase Firestore**" | Nothing is ever stored in Firestore. Cases live in an in-memory `Map`; restart = data gone. The only Firestore code is a best-effort read/write in `pdfRoutes.js` that silently fails without credentials. |
| C3 | README: "**AI-generated** prep questions" | `server.js:318-375` is a hard-coded table of 5 questions per stage. No AI is involved. The only Gemini call is the order-PDF summary, which **no frontend code calls**. |
| C4 | Landing page: "**CNR numbers are never logged**" / "does not store your personal data" (`LandingPage.jsx:135`) | Server logs every CNR and CAPTCHA, and writes the full case response to disk (S7). Live results are cached in memory indefinitely. |
| C5 | README formula: stage multiplier `0.60 → 1.25`, fault `1.00 / 1.20 / 0.80 / 0.90` | Code (`adjournmentFormula.js:30-56`): stage `0.60 → 1.80`, fault `1.00 / 1.20 / 0.50 / 0.75`. Also the code header says "INDIAN **HIGH COURT**" formula, but the app is aimed at district-court CNRs. |
| C6 | Unsourced statistics presented as sourced: "64% of hearings end in adjournment", "17 years avg", "₹1.2L per family per decade", "3 Crore pending > 5 yrs", and a **quote attributed to "NJDG Case Flow Analysis, 2023"** (`LandingPage.jsx:82-84`, `HeroSection.jsx:16-41`) | README says 61% (DAKSH) while the UI says 64%. I could not trace the quote or the ₹1.2L figure to a source. Either cite precisely or remove the attribution — an invented quote credited to NJDG is the biggest credibility risk in the repo. |
| C7 | "Speedy trial alert … NJDG recommends 3 years civil / 1 year criminal" (`CaseDashboard.jsx:73-77, 192`) | Presented as an official benchmark; I could not verify it. |
| C8 | Share bar: "The WhatsApp message includes … **cost estimate**" (`CaseDashboard.jsx:561`) | Backend message (`server.js:513-521`) has no cost. |
| C9 | README "Local Setup": frontend at `localhost:5174`; env vars `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | Vite's default is **5173** (nothing sets 5174). `firebase.js` only reads `FIREBASE_SERVICE_ACCOUNT_PATH` (as in `.env.example`) — the README's env block does nothing. |
| C10 | README: 3 demo cases; Footer: "Built at **Hack2Skill 2026**"; README: "**Hack-N-Win 2025**" | Backend has 5 demo cases. The two hackathon names conflict. |
| C11 | "Delay Accountability Report" feature card (`LandingPage.jsx:110`) | The `/lawyer-stats` endpoint exists but the dashboard never calls it. No such UI. Same for the "countdown" in the Prep Card card (`:111`) — no countdown exists. |

---

## 🟠 Functional bugs

### Backend
| # | Bug | Where |
|---|---|---|
| B1 | **Cache-clear is broken.** `demoStore.removeCase` does not exist, and live results are written into `demoStore` (`setCase`), so a "cleared" live case stays. **[verified]** It also reports `wasPresent: true` for a demo case that remains. | `server.js:128, 144-150`, `data/demo-cases.js:168-202` |
| B2 | **Live lookups overwrite/mix with demo data.** Live cases go into the same Map as demo cases; `getAllCases()` returns the static array, so live cases never appear in `/api/demo-cases`, and a live CNR equal to a demo CNR replaces it. | `server.js:125-128`, `demo-cases.js:199` |
| B3 | **PDF download can never work for District courts.** (a) `getCookies()` returns `session.cookies`, an **object**, which axios sends as `Cookie: [object Object]` **[verified]**. (b) `searchByCNR` deletes the session right after the search (`ecourts.js:249`), so there is no session left to reuse. | `pdfRoutes.js:179-183`, `ecourts.js:249` |
| B4 | **Gemini model `gemini-1.5-flash` is retired**; the call will fail. Also `GEMINI_API_KEY` missing → 500. | `pdfRoutes.js:504` |
| B5 | **`/api/case/:cnr/drain` uses a different (simpler) formula than the dashboard**, and divides by zero for a case with no hearings (`NaN%`). `/summary` hard-codes `₹3,500` per adjournment. Three different cost numbers across the app. | `server.js:240-280, 567` |
| B6 | **Hearing order is assumed inconsistently.** `ecourts.js` treats `hearings[0]` as the latest (`:573, 585`); `server.js` treats `hearings[length-1]` as the latest (`:386, 453`) and `/summary` returns `slice(0,5)` as "recent". Demo data is oldest-first. One of these is wrong for live data. | `ecourts.js:573,585`, `server.js:386,453,569` |
| B7 | **Title/party parsing is brittle.** **[verified]** The `vs` regex runs over the whole page text, so a test page yielded the title `-04-202014-04-2020Further OrderJudge15-06-2020…Home \| Privacy vs Terms of Use pages`. | `ecourts.js:443-453` |
| B8 | **"District" is just characters 3-4 of the CNR** (`NA`), not a district name; the form's CNR legend also mislabels the parts (`NA`="Court", `01`="District"; the real format is state(2) + district(2) + establishment(2) + number(6) + year(4)). | `ecourts.js:594`, `FormPage.jsx:201` |
| B9 | **Classifier is unreliable.** **[verified]** `Further Order` → *adjourned*, `Appearance` → *productive*, `Dismissed in default` → *productive*, `Hearing`/`Order`/`Reply`/`Issues`/`Consideration` → *unknown*. Stage detection treats "allowed" or "decree" anywhere as Stage 8 (judgment) and maps "further order/mediation" to Stage 5. The headline "unproductive %" depends on this. | `ecourts.js:557-583, 652-683` |
| B10 | `POST /api/case/search` advertises `casenumber` as valid, then rejects it. **[verified]** | `server.js:186, 198` |
| B11 | No input validation: CNR isn't checked for type/length (`cnr: 123` falls through to a misleading "session_expired"); `cnr.toUpperCase()` on non-strings would throw. | `server.js:108-128` |
| B12 | `/whatsapp` handler has a no-op `req.params.cnr = req.params.cnr` and duplicates `/whatsapp-alert` almost line for line. | `server.js:508` |
| B13 | Express `app.get('/api/case/:cnr')` is declared before more specific `/:cnr/...` routes — works today, but is fragile. Minor. | `server.js:153` |

### Frontend
| # | Bug | Where |
|---|---|---|
| F1 | **Cost calculation maps every historical hearing to the *current* stage** (`sid = d.caseDetails.stageId`), so old Stage-1 adjournments are billed at Stage-5 multipliers. | `CaseDashboard.jsx:34-41` |
| F2 | **Fault mapping is wrong/dead:** `adjourned_other` → `mutual_consent`, so the `"opposite_party"` branch (1.20× and "recoverable") is unreachable in practice and `recoverableFromOP` is almost always 0. Demo rows like "opposite party counsel absent" are rated 0.75×. | `CaseDashboard.jsx:28-33` |
| F3 | **"Unproductive" count ≠ "adjournments" count.** The bar/header count `unknown` hearings as unproductive (`:13`) but the cost model only counts `isAdjournment === true` (`:47`), so the two numbers on the same screen disagree. | `CaseDashboard.jsx:13,47,423` |
| F4 | **Clerk fee counted twice** (1,500 in `calculateProfessionalFees` + `agentClerkFee` 1,500 in incidentals). A fee you type is silently increased by junior fees (+67% capped at ₹15k) — the label says "Lawyer fee per hearing". "Outstation (Train + Hotel)" never adds the hotel (`includeHotel` is never set). | `adjournmentFormula.js:143-159, 96-99`, `CaseDashboard.jsx:396-398` |
| F5 | **"Purpose of next hearing" shows the *last* hearing's purpose** (`lastHearing.purpose`), not the next. | `CaseDashboard.jsx:314` |
| F6 | **Question "why" text is wrong:** `contextualQuestions[i]` (extra *questions*) is used as the explanation for question *i*. | `CaseDashboard.jsx:112-115` |
| F7 | **"COPY LINK" copies `window.location.href`** — the site has no router, so it's just the home page. Refreshing the case page loses everything (state is only in memory); the browser Back button leaves the site. | `CaseDashboard.jsx:565`, `App.jsx` |
| F8 | **Demo data is stale:** all `nextHearingDate`s are in March–May 2025; today is Nov 2026, so the "next hearing", calendar button and "pulse" all show past dates. Better: generate dates relative to today. | `data/demo-cases.js` |
| F9 | **ICS / Google Calendar:** all-day event has `DTEND` = `DTSTART` (must be next day, exclusive); missing required `UID` and `DTSTAMP`; text not escaped (`,` `;`). Date goes through `toISOString()` (UTC), which can shift a day in some timezones. | `CaseDashboard.jsx:86-107` |
| F10 | **CAPTCHA is fetched on every Form page mount**, even for people who only click a demo case → 3 outbound eCourts requests per visit, and an error banner whenever eCourts is slow. | `FormPage.jsx:22` |
| F11 | `isCivil` = "case type doesn't contain 'crim'" — real eCourts types like `CC`, `Cr.M.P.`, `S.C.` are called civil, so the timeline benchmark is wrong. `yearsElapsed` uses `max(1, …)` so a 3-month-old case says "over 1 years". Disposed cases still get the "pending" alert. | `CaseDashboard.jsx:22-24, 76` |
| F12 | `normalizeCaseData` names are swapped: `petitionerAdvocate` holds the **petitioner**, `petitionerLawyer` holds the advocate. `classification` defaults to `'adjourned_other'` if missing; `hearings.reverse()` and `hearingDate` logic assume a particular input order. | `utils.js:129-161` |
| F13 | Order PDFs, summaries and actions (`/api/order/*`) are implemented in the backend but **never used by the frontend** (`orderPdfUrl` is carried and ignored). Demo `orderPdfUrl` values (`/demo/orders/*.pdf`) point to files that don't exist. | `demo-cases.js`, `frontend/src` |

---

## 🟡 Quality, UX and maintainability

**Lint / build** — `npm run build` ✅ passes. **`npm run lint` fails with 16 errors** **[verified]**: unused `cnr` param (`App.jsx:11`), unused `err` (`FormPage.jsx:32`), and 14 `no-useless-escape` in regexes (`utils.js:44, 59, 102`). Quick fix; do it before showing anyone the repo.

**Responsiveness** — there is not a single `@media` query. Fixed grids (`55%/43%`, `380px 1fr`, `repeat(3,1fr)`, 4-column footer, `padding: 48`) will break on phones — and the audience for this product is ordinary litigants on mobile.

**Accessibility** — nav links, footer links and demo rows are `div`/`span` with `onClick` (not keyboard-reachable); form inputs have `<label>` without `htmlFor`; two `<h1>`s on the dashboard; the CAPTCHA refresh and error banner have no `aria-live`; hover effects are done in JS; heavy inline styling means there is no `prefers-reduced-motion` for the scroll animation or reveal transitions. Text colors `--ink-30` on white fail contrast in several places (e.g. "upcoming" stage labels).

**Dead UI** — "HOW IT WORKS", "ABOUT" nav items just go to landing; footer "Demo Cases / NJDG / NIC" etc. are non-links; `index.css` and `App.css` are empty placeholders (and not imported); `frontend/README.md` is the untouched Vite template; `public/vite.svg` is the favicon; `assets/react.svg` unused.

**Dependencies** — backend declares but never uses: `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth` (also a "stealth" scraper looks bad in a demo of a civic tool), `@google/genai`, `pino`, `pino-pretty`, `node-cron`, `tough-cookie`. Package name is still `casewatch-backend` / "CaseWatch"; `.gitignore` still lists CaseWatch files. Frontend `package.json` name `frontend`, version `0.0.0`.

**Repo hygiene**
- `vakalat-hero-redesign-preview.html` (37 KB) at the repo root is a stray design preview. Delete or move to `docs/`.
- `backend/public/index.html` (1,520 lines) is a developer test console served at `/` in production. Fine for dev; do not ship or present as the UI.
- 67 hero frames (2.3 MB) are all preloaded before the hero shows anything (`HeroSection.jsx:58-82`); a failed frame is silently counted as loaded; the canvas is fixed at 1456×816 and stretched. Consider lazy-loading or a video/WebP sprite.
- `ecourts.js` re-`require`s `ecourts-codes.json` inside `parseCaseHTML` on every call; Express async handlers lean on Express 5 behaviour. Both fine, just noting.
- `pdfRoutes.js` header comments are out of date (mentions a 3-field URI; code uses 5 fields), and it imports `./services/ecourts` twice.
- Everything is global in-memory state (sessions, caches) → one process only, no persistence, caches never expire (memory growth).
- Logging is `console.log` with emojis throughout; no structured logging despite `pino` being installed.

**Testing / delivery** — there are **no tests** (the classifier, date parsing and cost formula are exactly the pure functions worth testing), **no CI**, **no Dockerfile/deploy config**, no `.env` validation, no `/health`-based start check. `VITE_API_URL` defaults to `http://localhost:3000` — fine for dev, but there's no deploy story.

**Legal / ethics to be ready for questions about**
- Scraping eCourts: check the portal's terms of use and be explicit that the user solves the CAPTCHA themselves. Drop the word "bypass" and the stealth-plugin dependency.
- "Cost of adjournment" and "your lawyer skipped hearings" are estimates built on assumed fee/wage tables and a heuristic classifier; the UI states "not legal advice" only in small print in two places. A short "how we estimate / limitations" panel would pre-empt the obvious question.
- Case data is personal data (party names, advocates). The privacy statement (C4) has to match reality.

---

## ✅ What's good (talk about these)
- Clear separation: scraper service / PDF routes / demo store / React UI; sensible API surface (`summary`, `hearings`, `stage`, `prep`, …).
- The scraper handles the real eCourts session + CAPTCHA relay flow, with TTL'd one-time sessions and graceful errors (invalid CAPTCHA/CNR, expired session).
- Demo mode means the app is demonstrable with zero setup and no external dependency.
- Cost model is documented with named assumptions and legal references, and is parametrised and exported as pure functions (easy to unit test).
- Frontend builds clean (264 kB JS / 79 kB gzip), consistent design system, good empty/loading states, scroll-driven hero.
- No secrets committed (`serviceAccountKey.json`/`.env` ignored; `.env.example` has placeholders).

---

## Suggested order of work (≈ half a day for the first four)
1. **Fix S1, S2, S3, S5** (allow-list PDF host, remove/protect DELETE, error middleware, rate-limit + CORS).
2. **Delete unused deps** (S6/C1) → re-run `npm audit`; rename package from `casewatch-backend`.
3. **Make README/UI honest** (C1–C11): Puppeteer, Firestore, "AI", privacy line, formula constants, ports, hackathon name, stats with real sources or removed.
4. **Fix lint (16 errors)**, regenerate demo dates relative to today (F8), fix F5/F6 labels.
5. Fix the cost pipeline (F1–F4, B5) so there is **one** formula, stage taken from the hearing date.
6. Fix `getCookies`/session reuse (B3) *or* hide the PDF feature; update Gemini model (B4).
7. Add a router (`react-router`) so a case has a shareable URL (F7); add 10–15 unit tests for `classifyHearing`, `parseIndianDate`, `calculateAdjournmentImpact`.
8. Responsive pass + a11y pass; delete `vakalat-hero-redesign-preview.html`.


---

## Resolution status

Legend: ✅ fixed and covered by a test or a browser check · 🟡 fixed/mitigated with a caveat · ➖ removed instead of fixed

### Security
| # | Status | How |
|---|---|---|
| S1 SSRF | ✅ | `pdfUrl` query param removed. Order routes take `(cnr, hearingId)`; the order reference is stored server-side and the host comes from `PORTALS[courtType]`; the portal's `order` location is origin-checked. Regression test: a local listener receives **0** requests (was 2). |
| S2 open `DELETE` | ➖ | Route removed (404, tested); live cases now expire by TTL. |
| S3 stack traces | ✅ | JSON error handler + JSON 404; no paths/stacks (tested); body limit 10 kB; missing body handled. |
| S4 key in URL | ✅ | Official `@google/genai` SDK, key from env only; CNR/party names not sent to the model. |
| S5 rate limit / CORS | ✅ | `helmet`, `express-rate-limit` (strict on eCourts-facing and order routes), CORS allow-list (tested). |
| S6 vulnerabilities | 🟡 | Backend **45 → 8 (all moderate)**, **0 high/critical**; the 8 are a transitive `uuid` under `firebase-admin` (fix needs a breaking major). Frontend: 0. CI fails on high+. |
| S7 debug dumps / logs | ✅ | File dumps removed; pino logger with redaction; access log records route patterns, not CNRs. |

### Claims
| # | Status | How |
|---|---|---|
| C1 Puppeteer / "bypass" | ✅ | Puppeteer & stealth deps removed; README says "user-solved CAPTCHA relay". |
| C2 Firestore | ✅ | Real optional write-through (`firestorePersistence.js`, tested with a fake); memory-only otherwise, and the README says so. |
| C3 "AI-generated" | ✅ | README says static; the order reader is the only AI feature and is wired into the UI. |
| C4 privacy copy | ✅ | Copy rewritten to match behaviour (memory ~30 min, no disk, optional Firestore, CNR kept out of logs). |
| C5 formula constants | ✅ | README constants match `costModel.js`; header no longer says "High Court" only. |
| C6 unsourced statistics | ✅ | Removed 64 %, 17 yrs, ₹1.2 L, "3 crore >5 yrs" and the NJDG quote. Kept only figures with links (4.76 crore, 81,275 over 30 yrs, ≈54 % sitting time). I could **not** verify the old "61 %" either. |
| C7 "NJDG benchmark" | ✅ | Reworded as Vakalat's own reference timeline, not an official limit. |
| C8 WhatsApp claim | ✅ | Copy corrected. |
| C9 ports / env | ✅ | 5173 + proxy; env table matches code. |
| C10 hackathon / demo count | ✅ | Hackathon line removed everywhere (per your choice); README lists 5 demo cases. |
| C11 missing features | ✅ | Lawyer-stats card replaced by the Order Reader; countdown now exists. |

### Backend bugs
| # | Status | How |
|---|---|---|
| B1/B2 cache + demo mixing | ✅ | `CaseStore`: separate demo/live maps, TTL, live never overwrites demo (tested). |
| B3 PDF cookies/session | ✅ | Cookie jar kept per case and sent as a string (tested); extra find: `pdf-parse` v2 is a class — the old `pdfParse(buffer)` call would have thrown. |
| B4 Gemini model | 🟡 | Configurable (`GEMINI_MODEL`, default `gemini-2.5-flash`); **not exercised with a real key** — confirm the model id before relying on it. |
| B5 three cost formulas | ✅ | One model in the backend; `/drain` and the ₹3,500 hard-code removed. |
| B6 hearing order | ✅ | Invariant: oldest-first, ISO dates, sorted (tested). |
| B7/B8 parser, district, CNR legend | ✅ | Scoped title extraction; district never derived from CNR; 36 state codes; legend fixed. |
| B9 classifier | 🟡 | Rewritten table-driven, ambiguous → `unknown`, disposed separated, fault party + per-hearing stage (tested). Still a heuristic on one-line entries. |
| B10–B13 | ✅ | `casenumber` no longer advertised; input validation; `/whatsapp` merged; routes ordered and `router.param` validated. |

### Frontend bugs
| # | Status | How |
|---|---|---|
| F1/F2 stage + fault | ✅ | Backend computes per-hearing stage and fault; `opposite_party` is reachable (tested). |
| F3 inconsistent counts | ✅ | heard / adjourned / unclear / outcome everywhere; UI states what is not counted. |
| F4 clerk, hotel, fee label | ✅ | Double clerk fee removed; hotel included for outstation/intercity; juniors opt-in. |
| F5 next purpose, F6 "why" | ✅ | Real next-hearing purpose; per-question rationale from the API. |
| F7 routing / copy link | ✅ | `react-router`; `/case/<CNR>` survives refresh/back (browser-tested); Copy link copies it. |
| F8 stale demo dates | ✅ | Generated relative to today (tested). |
| F9 calendar | ✅ | All-day end = next day, UID/DTSTAMP, escaping, folding, no UTC shift (unit + browser tested). |
| F10 CAPTCHA on mount | ✅ | Fetched only once a valid CNR is entered (tested). |
| F11 civil/criminal, ages | ✅ | Broader criminal detection, hidden when disposed, months under a year. |
| F12 swapped fields | ✅ | `petitioner`/`petitionerAdvocate` correct; explicit sort. |
| F13 PDF feature unused | ✅ | "Read order" dialog with summary, actions, deadlines and PDF link (browser-tested incl. download). |

### Quality
| Item | Status | How |
|---|---|---|
| Lint | ✅ | Frontend 16 errors → 0; backend ESLint added, 0. |
| Responsive | ✅ | Breakpoints at 1024/720/640; Playwright: no horizontal overflow at 375/768/1280 on landing, track, dashboard. |
| Accessibility | 🟡 | Semantic links/buttons, labels, `aria-live`, single `h1`, skip link, dialog focus handling, reduced motion, contrast tokens. Verified by tests + keyboard/emulation checks, **not** a full axe/screen-reader audit. |
| Dead UI / deps / hygiene | ✅ | Real anchors, footer links, unused deps and files removed, packages renamed, stray preview + dev console deleted. |
| Tests / CI | ✅ | Backend 62 + frontend 35 tests; GitHub Actions workflow added (not yet run on GitHub). |

### Not verified
- The **live eCourts flow** (real CAPTCHA + real portal markup) — needs a human; parser is tested on a synthetic fixture only.
- **Real Gemini** and **real Firestore** calls.
- The new GitHub Actions workflow has not executed remotely yet.
