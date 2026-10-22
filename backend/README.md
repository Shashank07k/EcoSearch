# EcoSearch backend — Phase 4

Independent ES-module Node.js/Express API, MongoDB via Mongoose, native HTTP AI
integration, JWT authentication and role-based authorization. Existing health,
CRUD, pagination, search, AI analysis/caching, CORS and error handling are
retained.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # set MONGODB_URI and JWT_SECRET
npm run dev
# npm start
```

Configure `MONGODB_URI` (default example:
`mongodb://127.0.0.1:27017/ecosearch`), `PORT` (fallback 5000), `NODE_ENV`,
`CORS_ORIGIN`, a strong `JWT_SECRET`, and optional backend-only
`AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`. `src/config/env.js` remains the only
production module reading environment variables. No AI key is required for
startup or catalog operations. Without `JWT_SECRET` the app still starts, but
register/login and protected endpoints return a clean 503.

## Authentication & authorization

Users (`models/User.js`) have `name`, normalized lowercase unique `email`,
bcrypt `passwordHash` (bcryptjs, cost factor 12; `select:false`, never
serialized), `role` (`user` default, or `admin`), and timestamps. Passwords are
never logged or returned. Token logic lives in `services/token.service.js`
(`generateToken`/`verifyToken`); account logic in `services/auth.service.js`;
middleware in `middleware/auth.js`; validation in `middleware/validateAuth.js`.

JWTs are HS256 and contain `sub` (user id) and `role`; validity is
`JWT_EXPIRES_IN` (default `1d`). Each authenticated request re-fetches the user
from MongoDB, so deleted accounts and role changes take effect immediately and
client-supplied roles are never trusted.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | public; role is always `user` (client role fields ignored) |
| POST | `/api/auth/login` | public; one generic 401 for unknown email or wrong password |
| GET | `/api/auth/me` | any authenticated user |
| GET | `/api/products`, `/search`, `/:id` | public |
| POST | `/api/products/:id/analyze` | authenticated (`user` or `admin`) |
| POST/PUT/DELETE | `/api/products…` | `admin` only |

Missing/malformed/expired tokens return 401; a valid token without the required
role returns 403, in the standard `{ success:false, error:{...} }` envelope.
Register/login duplicate emails return 409 (case-insensitive). A lightweight
in-memory `express-rate-limit` guard throttles register/login (default
20 attempts / 15 minutes / IP; configured by `AUTH_RATE_LIMIT_*`; skipped under
`NODE_ENV=test`). Multi-instance deployments should also throttle at the proxy.

### Creating an administrator

Self-registration can never create an admin. The only supported path is the
explicit, idempotent bootstrap script (no hardcoded password, nothing printed):

```bash
ADMIN_NAME="Ada Admin" ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="StrongPassword123!" npm run create-admin
# or put ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env
```

There are no refresh tokens or server-side sessions yet; logout means the
client discards its JWT.

## Endpoints

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/health` | Existing API/database liveness report |
| GET | `/api/products?page=1&limit=10` | `{ success, products, page, limit, total, totalPages }`; limit max 50; public |
| GET | `/api/products/search?q=water` | `{ success, query, count, results }`; public |
| GET | `/api/products/:id` | `{ success, product }`; public |
| POST | `/api/products` | 201 `{ success, product }`; **admin** |
| PUT | `/api/products/:id` | Partial update; nested sustainability fields merge; **admin** |
| DELETE | `/api/products/:id` | `{ success, message }`; **admin** |
| POST | `/api/products/:id/analyze` | `{ success: true, cached: boolean, data: Analysis }`; authenticated |

Send the token as `Authorization: Bearer <token>`. See the authentication
section below for the auth endpoints and role rules.

Analysis accepts the product ID only; arbitrary request data is not sent to the
provider. IDs are public string `id` values, not `_id`/`__v`. Search remains an
escaped, case-insensitive MongoDB regex over name, description, brand, category,
with query length 2–100 and up to 50 results. Empty matches return a 200 array.

## Provider boundary

- `services/ai/aiProvider.js`: selects an implementation exposing
  `generateAnalysis({ messages, schema }) -> unknown`.
- `services/ai/llmProvider.js`: HTTP adapter for OpenAI-compatible
  `POST {AI_BASE_URL}/chat/completions` with bearer authorization,
  configurable model and strict `response_format: json_schema`.
- `services/sustainability.service.js`: orchestration, independent validation,
  cache checks, in-flight coalescing and database persistence. Providers can be
  injected into its factory for tests without network calls.
- `controllers/sustainability.controller.js`: thin HTTP envelope only.

Default model: `gpt-4o-mini`; default base: `https://api.openai.com/v1`.
Requires a provider/model supporting strict JSON-schema Chat Completions.
Remote connections require HTTPS; loopback HTTP is allowed. Embedded URL
credentials/query strings and invalid config fail lazily. Request deadline:
20 seconds including response reading; provider envelope cap: 64 KiB.
Redirects are rejected, raw provider messages are never logged/returned, and
refusals/truncated completions are treated as invalid responses.

## Prompt and validated wire schema

The dedicated prompt builder uses only name, description, category, brand and
price. It treats listing content as untrusted data (JSON-encoded, bounded), not
instructions, and excludes prior/seed analysis to avoid anchoring. The model is
instructed not to invent certifications, scientific measurements, carbon
footprints, or manufacturer claims. It must acknowledge uncertainty and that
its score is estimated, considering supported evidence for reuse, durability,
materials, repairability, packaging, lifespan, energy/resource implications and
end of life. Suggested alternatives are generic product types, not verified
matches or certified recommendations.

```text
Analysis:
  score: finite number, 0–100 (including both boundaries)
  summary: nonempty string, max 2400 characters
  factors: array, max 12
    name: nonempty string, max 120
    impact: positive | neutral | negative
    description: nonempty string, max 1200
  alternatives: array, max 6
    name: nonempty string, max 160
    reason: nonempty string, max 1200
```

All keys are required, unknown keys are rejected, numeric strings are not
coerced, and malformed JSON is not repaired. Arrays may be empty when evidence
is insufficient. Backend validation runs independently of provider enforcement.
Nothing is saved, and no success is returned, for invalid output.

## Mongoose storage / cache

Existing fields are reused: `sustainability.score`, `.summary`, `.factors`, and
`ecoAlternatives` (mapped from wire `alternatives`, no duplicate storage).
Three optional server-managed fields are added:

- `sustainability.analyzedAt`: successful-save timestamp.
- `sustainability.analysisVersion`: assessment policy version (`sustainability-v1`).
- `sustainability.analysisInputHash`: SHA-256 of the version + canonical full
  name/description/category/brand/price input. Hidden from ordinary queries/API.

No migration/reseed is required. Existing products naturally have no AI cache.
Manual/illustrative seed scores cannot be mistaken for AI analyses. Incoming
create/update payloads cannot set these metadata fields.

A cache is accepted only with valid timestamp/version/fingerprint **and** valid
persisted content. It survives process restarts and works even without an AI
key. There is no automatic expiry for unchanged information; bump the policy
version to intentionally invalidate all analyses after prompt/model changes.

`PUT` compares normalized inputs. Changes to name, description, category, brand
or price clear provenance and old AI conclusions/alternatives. Explicit manual
analysis edits also clear provenance. Image-only and normalized no-op edits
preserve the cache. Fields explicitly supplied in a manual update are retained.

Catalog updates and analysis saves increment the existing hidden `__v` version
key. Analysis writes compare it atomically to the read snapshot; a concurrent
edit/deletion returns 409/404 instead of overwriting or serving stale output.
Equivalent concurrent requests coalesce within one process (maximum 8 distinct
in-flight generations). Multi-instance rate limits/spend control belong at the
deployment boundary; no automatic provider retries are performed.

## Clean failures

Errors follow the existing `{ success: false, error: { status, message,
details?, code? } }` format. Only fixed safe AI error codes are exposed:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `AI_UNAVAILABLE` | 503 | Missing key, provider rate limit, or local capacity |
| `AI_CONFIGURATION_ERROR` | 503 | Invalid config/provider authorization |
| `AI_TIMEOUT` | 504 | Provider request/body deadline |
| `AI_PROVIDER_ERROR` | 502 | Network failure or other upstream 4xx/5xx |
| `AI_INVALID_RESPONSE` | 502 | Bad envelope/JSON/schema, refusal, truncation |
| `ANALYSIS_SAVE_FAILED` | 503 | Database could not persist the validated result |
| `PRODUCT_CHANGED` | 409 | Input changed while AI was working |

Invalid ObjectIds remain 400, unknown products 404, and an unavailable database
returns 503. No stack traces, credentials or raw provider payloads are sent to
clients. A failed analysis does not disrupt other catalog/search operations.

## Tests / seed

```bash
npm test
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/ecosearch_test_phase4 npm test
```

Node's built-in test runner with a test-only `test/setup.js` that supplies a
non-production `JWT_SECRET` and `NODE_ENV=test`; no test framework dependency is
required. Unit tests mock provider/model boundaries. The integration suite uses
real Mongoose/Express and only mocks AI, and refuses non-test database names.
Coverage includes registration validation/duplicates/role-escalation, generic
login failures, bcrypt hashing, valid/missing/malformed/expired/forged JWTs,
`/me`, admin vs user vs anonymous authorization for every product route,
analysis authentication, plus score boundaries, provider failures/timeouts,
malformed AI output, persisted caching after restart, concurrent writes,
metadata forgery and all existing catalog APIs. The test-only browser server
under `test/support/` is never mounted in production and only runs against
`ecosearch_test_*` databases.

`npm run seed` loads the existing 28 demo products (INR prices, numeric rupee values); **it replaces products**
unless `-- --append` is used. No other collection/database is deleted. Its
scores are illustrative, not generated/certified AI analyses. Never seed an
established production catalog casually. `npm run create-admin` upserts one
admin from `ADMIN_*` environment variables.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | for data features | local default documented in `.env.example` |
| `PORT` | no | fallback 5000 |
| `CORS_ORIGIN` | no | restrict to the frontend origin in production |
| `JWT_SECRET` | for auth | generate with `openssl rand -hex 32`; never commit/ship to the frontend |
| `JWT_EXPIRES_IN` | no | default `1d` |
| `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` | no | backend-only; uncached analysis returns 503 without a key |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | no | defaults 20 / 900000ms, skipped in test |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | no | used only by `npm run create-admin` |

## Search history and favorites (Phase 5)

Private per-user data. The user id is taken only from the verified JWT
(`req.user.id`). Client-supplied user ids are ignored.

**History** (`SearchHistory`): `user`, original `query`, `normalizedQuery`
(lowercase, collapsed whitespace), `resultCount`, `searchedAt`. Indexes:
`{ user, searchedAt }`, `{ user, normalizedQuery }`. Recording happens after a
successful `GET /api/products/search` when a valid token is present; anonymous
search is unchanged. If the same user repeats the same normalized query within
**10 minutes**, the existing row is updated instead of inserting another.
History write failures are logged and never fail the search response.

**Favorites** (`Favorite`): `user`, `product`, `createdAt`, unique compound
index `{ user, product }`. Duplicate POSTs return 200 with `created: false`.
When an admin deletes a product, matching favorite rows are cascade-deleted.
Authenticated catalog/search/detail responses include `favorited` via one
batched query over the page of product ids.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/history?page&limit` | owner only |
| DELETE | `/api/history/:id` | owner; other users receive 404 |
| DELETE | `/api/history` | clears the current user only |
| GET | `/api/favorites?page&limit` | populated products |
| GET/POST/DELETE | `/api/favorites/:productId` | state / add / remove |

## Comparison and recommendation (Phase 6)

Both endpoints are public. Deterministic recommendation rules:

1. Pick the product with the highest sustainability score.
2. If tied within 3 points, the cheaper product wins (better_value).
3. If still tied, result is `tied`.
4. If no product has score data, result is `no_data`.

| Reason code | When |
| --- | --- |
| `higher_sustainability_score` | winner has a clear score advantage |
| `similar_score_lower_price` | scores tied, winner is cheaper |
| `similar_score_similar_price` | genuine tie |
| `no_sustainability_data` | none of the products have score data |
| `better_reusability`, `better_durability` | winner has a positive factor that runner-up does not |

AI explanations are optional and cached by fingerprint (sorted product IDs +
per-product analysis versions + policy version). They are computed after the
deterministic recommendation and are told explicitly not to invent facts or
override the backend decision.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/products/compare?ids=a,b,c` | 2–4 valid ObjectIds, deduped, ordered |
| POST | `/api/products/recommend` | Body `{ productIds: [...] }`; 2–4 products |
