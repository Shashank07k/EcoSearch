# EcoSearch frontend — Phase 6

Independent React + Vite UI. Product data comes only from the real backend,
never a frontend fixture. AI provider credentials and provider HTTP calls are
backend-only.

## Start / build

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
npm test
npm run build
```

Use Node.js 22 LTS. Vite serves http://localhost:5173. The default public
`VITE_API_BASE_URL=/api` uses a development proxy to Express port 5000.
For separate deployment set `VITE_API_BASE_URL` to your public backend API URL,
configure backend CORS, and rebuild. The production static host must proxy
`/api` or use that full URL. Never use `VITE_AI_API_KEY` or other secret values.

## Authentication (Phase 4)

- `context/AuthContext.jsx` exposes `user`, `token`, `isAuthenticated`,
  `loading`, `login()`, `register()`, `logout()` and `hasRole()`, so no prop
  drilling is needed. On load it validates a stored token via `/api/auth/me`.
- `services/authService.js` calls only backend auth endpoints;
  `services/tokenStore.js` persists the opaque JWT in `localStorage` under
  `ecosearch_token`; `apiClient.js` attaches `Authorization: Bearer <token>` and
  ends the session on a 401 from protected (non-auth) endpoints.
- A tiny dependency-free hash router (`hooks/useHashRoute.js`) serves
  `#/` (public catalog), `#/login`, `#/register`, and `#/dashboard`
  (`components/ProtectedRoute.jsx` redirects anonymous users to login).
- Logout simply removes the token; register and login auto-authenticate.
- The catalog/search remain fully public. **Analyze Sustainability** is the
  protected feature: anonymous users are sent to the login page; logged-in
  users call `POST /api/products/:id/analyze`; product write actions are
  admin-only on the backend (there is intentionally no admin UI yet).
- No AI or JWT secrets exist in frontend code or `VITE_*` variables.

**localStorage tradeoff (deliberately simple for this student project):** any
successful XSS on the origin could read the token, and it cannot be HttpOnly.
Mitigations: all AI/user strings render as React text (no
`dangerouslySetInnerHTML`), tokens are short-lived (`JWT_EXPIRES_IN=1d`), no
refresh tokens are stored, and logout deletes the token. A production app
should use HttpOnly + Secure + SameSite cookies with CSRF protection.

## Components / flow

- `pages/Home.jsx`: live paginated catalog, category/search actions, transparent
  scoring explanation, responsive page layout.
- `hooks/useProductSearch.js`: initial load, pagination, search, loading, empty
  matches, invalid response, network/API error, retry, cancellation.
- `components/ProductCard.jsx`: product, brand, price, category, catalog estimate
  and an explicit analyze action (**Sign in to analyze** when logged out,
  **Analyze Sustainability** when authenticated).
- `hooks/useSustainabilityAnalysis.js`: isolated per-card idle/loading/success/
  cached/unavailable/invalid/error state and retry. No fabricated delays/results.
- `services/sustainabilityService.js`: calls only
  `POST /api/products/:id/analyze`, then validates the response envelope/data.
- `components/AnalysisResult.jsx`: **AI Sustainability Analysis** heading, score,
  interpretation, summary, environmental factors and potential alternatives.
- `utils/analysis.js`: frontend validation and rating boundaries.

Product cards remount when the catalog product's update timestamp changes;
requests are aborted on unmount. Checking a saved result still calls the backend
so persistent cache validity is decided by the server, not a browser cache.
Analysis failures remain local to their card and never replace catalog results.
All strings are React text nodes; there is no raw HTML rendering.

## Interpretation and provenance

0–39 Low · 40–59 Moderate · 60–79 Good · 80–100 Excellent.
These labels are an EcoSearch interpretation, **not a scientific standard**.
Catalog/manual/illustrative scores are labeled as catalog estimates. Only
server-provenance results are labeled AI estimates. Expanded analyses explicitly
state that they are estimates based on listing information, not certifications.

## Tests

`npm test` runs focused validation, rating, credential-policy and token-storage
tests without a browser or network. From the repository root,
`npx playwright test` runs Chromium against the real Vite + Express + MongoDB
flow using the test-only AI provider. MongoDB must be available on
127.0.0.1:27017. See the root README for optional harness tooling.

Browser scenarios cover initial catalog, pagination, search/no results,
observed network loading, valid analysis, persistent cache after reload,
unavailable/invalid/failing AI and retry, actual database outage/recovery,
escaped HTML-looking model output, mobile overflow/accessibility, registration
(including client role-escalation attempts), login with generic errors,
logout, protected-route redirects, the anonymous analyze login guard, and
real-JWT role enforcement (anonymous 401, user 403, admin 201).
No live external provider or credentials are used by tests.

## Comparison and recommendation (Phase 6)

Product cards expose a **Compare** toggle (max 4). A sticky `CompareBar`
appears after the first selection and opens `#/compare` with a deterministic
recommendation plus an optional AI explanation. Favorites continue to work on
the comparison page.
