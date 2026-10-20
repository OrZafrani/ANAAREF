# COBRA security review

Review of `main` at `56c31e5` (October 2026), using the team's `owasp-security`, `threat-modeling`,
`insecure-defaults`, `supply-chain-risk-auditor` and `variant-analysis` skills. The Strix pentest
skills were not run: they require the infrastructure team's Strix CLI and a PreProd target, neither
of which exists yet.

## Scope

The backend REST API (`backend/src`), the Kafka producer and run scheduler, the CSV seed loader,
the React frontend (`frontend/src`), configuration (`.env.example`, `docker-compose.yml`, Vite) and
npm dependencies. Out of scope: the Data Engineering consumer of `reports.enriched`, the shared
Kafka cluster and the PostgreSQL server itself.

## Entry points and trust boundaries

| Entry point | Who is on the other side | Boundary |
| --- | --- | --- |
| `/api/categories`, `/api/sub-categories`, `/api/templates`, `/api/library` (read and write) | Any browser or client that can reach the backend | Browser → backend |
| `/api/simulations/:id/runs` (start, stop, read) | Same | Browser → backend → Kafka |
| `reports.enriched` Kafka topic (produced) | Data Engineering consumers, which trust every message | Backend → shared cluster |
| `backend/src/seed/reports_library_seed.csv` | Repository contributors | Repo → database |
| PostgreSQL connection | Database server | Backend → database |
| Browser storage (`cobra_simulations`, drafts, theme) | The user's own browser | Not a trust boundary |

There is no authentication or authorization anywhere in the API.

## Threat model

Highest risk first. "Fixed" items were changed on branch `security-hardening`.

| # | Threat / abuse case | Entry point | STRIDE | Rating | Mitigation | Test that proves it |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Anyone who can reach the API deletes or rewrites the library, or starts runs that publish reports to the shared topic. | All `/api` routes | S, T, E | **High** | **Open.** Add sign-in and a permission check on every write route and on starting/stopping runs, deny by default. Needs the team's identity provider (Mirage). | Write request without credentials returns 401; with a read-only user returns 403. |
| 2 | A website a team member visits calls the API from their browser (CORS was `*`): reads data, deletes categories, starts runs. | All `/api` routes | T, I | High | **Fixed.** CORS allow-list from `CORS_ORIGINS`, empty by default (the frontend uses the Vite proxy, same origin). POST and PATCH must be `application/json`, so a cross-site form post (which skips CORS preflight) is refused with 415, including for start/stop run, which take no body. | `backend/src/lib/security.test.ts` (`corsOptions`, `requireJsonForWrites`). |
| 3 | Another machine on the network reaches the unauthenticated API, because it listened on every interface. | Backend port | I, T | High | **Fixed.** Listens on `127.0.0.1` unless `HOST` is set. | `curl` from another machine is refused. |
| 4 | Database traffic is intercepted: `.env.example` set `NODE_TLS_REJECT_UNAUTHORIZED=0`, which turns off certificate checks for **every** outgoing TLS connection. | PostgreSQL connection | I, T | High | **Fixed in the example and code.** `DATABASE_SSL_CA` enables verified TLS with a private CA; the backend warns at boot if the old variable is still set. **Action:** remove it from your real `backend/.env`. | Boot log shows no `[security]` warning. |
| 5 | Reports are read or forged on the Kafka cluster: the producer has no TLS or SASL settings. | `reports.enriched` | S, T, I | Medium | **Open.** Add `ssl`/`sasl` options to `backend/src/kafka.ts` once the shared cluster's settings are known. | Producer refuses to connect without credentials. |
| 6 | A seed CSV row (or a row written outside the API) with a `javascript:` `report_url` runs script when a user opens the source link. | Seed loader → template dialog | T, E | Medium | **Fixed.** Seed loader applies the API's `http(s)` rule; the frontend only renders `http(s)` links (`frontend/src/lib/safeUrl.ts`). | Seed with a `javascript:` URL fails; link shows "קישור לא תקין". |
| 7 | A script floods write routes or repeatedly starts runs. | Write routes, runs | D | Medium | **Fixed (per process).** 120 writes per client IP per minute (`RATE_LIMIT_WRITES_PER_MIN`), explicit 512 KB body limit. Behind a shared proxy all users share one IP. | `security.test.ts` (`writeRateLimit`). |
| 8 | Large unpaginated reads (`GET /api/templates`, `/api/library/reports`) as the library grows. | Read routes | D | Low | **Open.** Add `limit`/`offset` with a server-side cap. | List request returns at most the cap. |
| 9 | Changes cannot be attributed to a person. | All write routes | R | Low | **Open.** Depends on #1; then log user, action and record id for writes and run starts. | Audit log entry per write. |
| 10 | Responses rendered or framed by the browser, or cached by proxies. | All responses | I | Low | **Fixed.** `nosniff`, `X-Frame-Options: DENY`, CSP `default-src 'none'`, `Cache-Control: no-store`, no `X-Powered-By`. | `security.test.ts` (`securityHeaders`). |

Checked and found sound: every query is parameterised and dynamic column names come from a fixed
list (no SQL injection); request bodies, params and queries are validated with allow-listed fields;
unhandled errors return a generic message; no secrets are committed to the repository or its history.

## Dependencies and runtime

`npm audit` reported 8 advisories (2 critical, 1 high, 5 moderate):

- **Fixed:** `react-router-dom` 6 → 7.18.4 (open redirect via backslash paths, GHSA-wrjc-x8rr-h8h6).
  The app's links and navigation are all static, so this was not reachable, but the upgrade is
  compatible and closes it.
- **Open, development only:** `vitest` 2.x and its `vite`, `vite-node`, `esbuild`, `tinypool` and
  `@vitest/mocker` copies. These affect the test runner and dev tooling, not the shipped app. The
  fixed `vitest` 5.x requires Node 22.12+.
- **Open: Node 20 is end-of-life** (April 2026) and no longer receives security fixes. Move the team
  and any deployment to Node 22 or 24 LTS, then upgrade `vitest` to 5.x.
- The frontend loads IBM Plex from Google Fonts and map tiles from openstreetmap.org at runtime. On
  a closed network these requests fail; elsewhere they disclose users' IP addresses to those
  services. Self-host the fonts and point the map at an internal tile server when deploying.

## Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Interface the API listens on. Use `0.0.0.0` only behind a firewall or reverse proxy. |
| `CORS_ORIGINS` | empty | Comma-separated browser origins allowed to call the API directly. |
| `RATE_LIMIT_WRITES_PER_MIN` | `120` | Writes per client IP per minute. |
| `DATABASE_SSL_CA` | empty | CA certificate (PEM path) for verified TLS to PostgreSQL. |

## Before production

1. Decide on and add authentication and per-route permissions (#1); it is the largest gap.
2. Configure Kafka TLS and SASL for the shared cluster (#5).
3. Serve the frontend with security headers, including a Content-Security-Policy; the inline
   theme script in `frontend/index.html` needs a hash or nonce entry.
4. Upgrade to a supported Node LTS and then `vitest` 5.x.
5. Run the Strix pentest against PreProd once it exists.

Revisit this model when a new entry point, permission or integration is added.
