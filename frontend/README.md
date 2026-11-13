# Vakalat — web app

React 19 + Vite single-page app. See the [root README](../README.md) for the full project.

```bash
npm install
npm run dev      # http://localhost:5173  (proxies /api → http://localhost:3000)
npm run lint
npm test         # Vitest + Testing Library
npm run build    # production build in dist/
```

- Routes (`react-router`): `/` landing · `/track` CNR form · `/case/:cnr` dashboard (shareable URL).
- All data comes from the backend (`src/services/api.js`). The adjournment-cost maths lives **only** in the backend (`POST /api/case/:cnr/cost`).
- For a separately hosted API set `VITE_API_URL` (see `.env.example`). A static host needs a "serve `index.html` for unknown paths" rewrite for deep links such as `/case/…`.
- Styles: `src/styles/{tokens,base,layout}.css`; the hero has its own `components/HeroSection.css`.
- Windows note: run `npm test` from a shell whose current directory uses the canonical drive-letter case (e.g. PowerShell `C:\…`); Vitest can fail to start from Git Bash paths like `/c/…`.
