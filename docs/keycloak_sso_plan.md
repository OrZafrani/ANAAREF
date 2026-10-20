# Keycloak SSO Integration Plan

**Status:** Planning  
**Owner:** Project team  
**Systems involved:** React/Vite frontend, Express API, Keycloak, and Mirage if it remains the role authority

## 1. Mission

Offer users a clear **Log in with SSO** option when they enter the website, authenticate them with the project’s Keycloak instance, and protect API access using verified identity and the agreed role policy. Provide an environment-controlled way to disable SSO during an outage without silently making protected API routes public.

The currently supplied SSO tunnel base URL is `https://sso.rose.localhost`. The realm, issuer, client registration, application URLs, and outage policy still need confirmation from Infra and the project team.

## 2. Current project context

- The frontend is React with Vite; the API is Express with TypeScript.
- The frontend currently has no OIDC client dependency or shared authenticated API client.
- The API currently has no Keycloak token-validation middleware; routes are mounted in `backend/src/index.ts`.
- `backend/src/config.ts` currently reads Kafka and scheduler settings, not authentication settings.
- `COBRA.md` describes Keycloak-issued JWTs, a Mirage role service, and lists `KEYCLOAK_REALM_URL`, `KEYCLOAK_CLIENT_ID`, and `KEYCLOAK_CLIENT_SECRET` as intended configuration. It also says the exact Mirage roles endpoint contract is pending.
- `backend/.env.example` currently includes `NODE_TLS_REJECT_UNAUTHORIZED=0`. Do not rely on that setting for SSO; configure the correct trust chain for the Keycloak certificate instead.

## 3. Goals and boundaries

### Goals

1. Let a user start SSO from the website entry/login experience.
2. Complete sign-in and sign-out using the confirmed Keycloak OIDC configuration.
3. Validate access tokens on the API and enforce the agreed access/role rules server-side.
4. Support separate configuration for development, staging, and production.
5. Provide clear behavior when SSO is disabled or Keycloak is unavailable.
6. Keep credentials and tokens out of logs and prevent client secrets from entering frontend bundles.

### Out of scope until separately agreed

- Changing the Mirage role model or provisioning users/roles.
- Creating an alternative local account system or a production authentication bypass.
- Changing unrelated API authorization rules beyond routes covered by the agreed auth policy.

## 4. Inputs to collect before implementation

Collect these values for **development, staging, and production**. Track them in a secure team configuration source; do not commit secrets to this plan or to Git.

### Keycloak / OIDC

- [ ] Realm name.
- [ ] Exact issuer URL.
- [ ] Exact OIDC discovery URL. It often follows `https://sso.rose.localhost/realms/<realm>/.well-known/openid-configuration`; Infra must confirm the actual path and returned issuer.
- [ ] Confirmation that the discovery document and its endpoints are reachable from the user’s browser and from the API runtime as required by the chosen architecture.
- [ ] Client ID and client type (public or confidential).
- [ ] Supported flow. Default proposal: Authorization Code with PKCE for a browser client.
- [ ] Scopes and required token claims: stable user ID (`sub`), email, display name, and any group/role claims.
- [ ] Signing algorithms and the JWKS location supplied in discovery metadata.
- [ ] Session/token lifetime and refresh behavior expected by the identity team.

### App registration URLs

The project team must determine the deployed URLs and callback route, then give the exact values to Infra to register. Avoid wildcard callback URLs.

- [ ] Frontend origin for each environment.
- [ ] API origin for each environment.
- [ ] Exact redirect/callback URL for each environment.
- [ ] Exact post-logout redirect URL for each environment.
- [ ] Exact allowed web origin(s) for each environment.
- [ ] Any reverse-proxy path prefix or externally visible host/port that changes those URLs.

### Authorization / Mirage

- [ ] Confirm whether authorization roles come from Keycloak token claims or Mirage.
- [ ] If Mirage remains the role authority: base URL, exact roles endpoint path, HTTP method, request/response schema, service/user authentication method, timeout, and error behavior.
- [ ] Mapping from project roles to permissions and which API routes are public, authenticated, or role-restricted.
- [ ] Behavior for a valid Keycloak user with no assigned application role.

### Network, TLS, and operations

- [ ] VPN, DNS, proxy, firewall, and certificate-chain requirements for the tunnel and production Keycloak host.
- [ ] Whether local development uses a development CA and how developers should trust it.
- [ ] Health/availability expectations and operational owner/contact for Keycloak and Mirage.
- [ ] Approved outage policy: existing sessions, new login attempts, protected API behavior, and any break-glass access procedure.

## 5. Decisions to record before coding

Record these in an ADR or in this plan before implementation begins:

1. **OIDC integration shape:** SPA client with Authorization Code + PKCE and in-memory token handling, or a backend-for-frontend (BFF) that keeps tokens server-side and issues an HttpOnly, Secure, SameSite session cookie. Prefer BFF if the deployment can support it; otherwise use a reviewed SPA OIDC library and avoid persistent browser storage for tokens.
2. **Callback ownership and route:** frontend callback or backend callback; use the exact route in the redirect URI registration.
3. **Role authority:** token claims or Mirage. Do not assume the Mirage contract before its owner supplies it.
4. **Protected-route policy:** explicitly list which endpoints require authentication and which require roles. Keep health/readiness endpoints intentionally public or internal as appropriate.
5. **SSO disable/outage semantics:** define what the `SSO_ENABLED` flag does in each environment. Production must not interpret `false` as “allow anonymous access.” Recommended behavior is to disable new SSO login, show an unavailable/maintenance state, and deny protected API calls unless an approved independent fallback is configured.

## 6. Proposed configuration

Use the existing backend configuration loader and deployment secret store. Names below are proposals and should be reconciled with `COBRA.md` before implementation.

### Backend settings

| Variable | Purpose | Secret? |
|---|---|---|
| `SSO_ENABLED` | Enable SSO login/integration in this environment; default should be explicit per environment. | No |
| `KEYCLOAK_ISSUER_URL` | Expected issuer; must match the discovery document and token `iss`. | No |
| `KEYCLOAK_CLIENT_ID` | OIDC client identifier. | No |
| `KEYCLOAK_CLIENT_SECRET` | Only for a confidential backend/BFF client; never expose to Vite/browser. | Yes, if used |
| `KEYCLOAK_REDIRECT_URI` | Registered callback URL when the backend owns the callback. | No |
| `MIRAGE_ROLES_URL` | Roles endpoint, only if Mirage is confirmed as role authority. | No |
| `MIRAGE_SERVICE_TOKEN` | Mirage service credential, only if required by its contract. | Yes, if used |

### Frontend settings

For a SPA, Vite-exposed values are public configuration only, such as `VITE_SSO_ENABLED`, issuer/discovery URL, client ID, and callback route. Never place a client secret or service credential in a `VITE_*` variable. If using BFF, the browser should use the application’s same-origin login/logout endpoints rather than receive Keycloak secrets.

### Flag requirements

- Parse boolean values strictly and validate required settings at startup when SSO is enabled.
- In production, fail startup or enter a deliberate maintenance/auth-unavailable mode if required SSO configuration is missing.
- When SSO is disabled, do not remove API authorization middleware or make protected endpoints anonymous.
- If a development-only mock identity is required, guard it so it cannot be enabled in production and make the mode visible in logs/UI without logging credentials.

## 7. End-to-end implementation work

### Phase 0 — Confirm contracts and access

- [ ] Complete the Infra checklist in Section 4.
- [ ] Resolve the five architecture decisions in Section 5.
- [ ] Verify discovery metadata from a network location matching the runtime; confirm `issuer`, authorization/token/logout endpoints, and `jwks_uri`.
- [ ] Confirm frontend/API callback and origin values with the deployment owner and have Infra register them.
- [ ] Document role mapping and endpoint protection requirements.

**Exit condition:** no unknown realm/client/callback/role/outage contract blocks implementation.

### Phase 1 — Configuration and dependency design

- [ ] Select and document a maintained OIDC library that supports the chosen SPA or BFF design.
- [ ] Add typed backend configuration for SSO, issuer, client settings, and optional Mirage configuration.
- [ ] Add non-secret examples to `backend/.env.example` and frontend example configuration where applicable.
- [ ] Keep client secrets and service credentials in the deployment secret manager and local ignored `.env` files only.
- [ ] Configure proper CA trust for the Keycloak tunnel; remove any dependency on disabling TLS verification for this integration.
- [ ] Configure CORS and proxy settings from the confirmed frontend/API origins.

**Exit condition:** each environment can start with validated config; missing required values produce a clear error.

### Phase 2 — User login/logout experience

- [ ] Add an entry/login state with a clear “Log in with SSO” action.
- [ ] Initiate OIDC Authorization Code with PKCE using state and nonce validation through the chosen library.
- [ ] Implement the registered callback route and restore the intended post-login destination safely.
- [ ] Show loading, cancellation, access-denied, and provider-unavailable states.
- [ ] Add logout that clears local session state and uses the configured Keycloak logout flow/return URL.
- [ ] Handle session expiry and failed refresh without redirect loops; provide a clear path to sign in again.
- [ ] Avoid placing tokens in URLs, logs, analytics, or long-lived browser storage.

**Exit condition:** users can complete login/logout and receive understandable error states in a configured environment.

### Phase 3 — API authentication and authorization

- [ ] Add Express authentication middleware for protected API routes.
- [ ] Validate JWT signature using Keycloak JWKS; cache keys and refresh them safely for key rotation.
- [ ] Validate issuer, audience/client, expiry, not-before, and allowed algorithms; reject malformed or unverifiable tokens.
- [ ] Attach a normalized identity to the request using stable identity claims; do not trust user/role headers supplied by the browser.
- [ ] Implement Mirage role lookup or token role extraction according to the agreed source and mapping.
- [ ] Apply authentication and role middleware to the explicitly listed API routes; return consistent `401` and `403` responses.
- [ ] Keep readiness/liveness and any intentionally public routes explicitly classified.
- [ ] Ensure logs redact authorization headers, tokens, secrets, and sensitive identity claims.

**Exit condition:** protected API access requires a valid identity and the required permission, even when frontend controls are bypassed.

### Phase 4 — SSO switch and outage handling

- [ ] Implement `SSO_ENABLED` consistently in frontend and backend, with server-side policy authoritative for protected API access.
- [ ] When disabled, show an unavailable/maintenance state and prevent new SSO login attempts.
- [ ] Keep protected API routes denied unless the user has an approved independent authentication path.
- [ ] Decide whether already-issued access tokens remain usable until expiry while Keycloak is unreachable; signature validation can use cached JWKS, but refresh/new login requires provider availability.
- [ ] Define timeout/retry behavior for discovery, JWKS refresh, and Mirage role lookup so provider outages do not hang API requests.
- [ ] Add operational instructions for disabling/re-enabling SSO and required config reload/restart behavior.
- [ ] Verify production startup rejects unsafe combinations, such as SSO disabled with protected routes configured to allow anonymous access.

**Exit condition:** the outage mode is predictable, visible, and does not silently bypass API authentication.

### Phase 5 — Verification and security review

- [ ] Verify successful login, callback validation, logout, and route refresh behavior.
- [ ] Verify expired, malformed, wrong-issuer, wrong-audience, bad-signature, and revoked/unknown-user token cases.
- [ ] Verify anonymous requests receive `401` and authenticated users without required roles receive `403`.
- [ ] Verify role lookup failures follow the agreed deny/fallback policy.
- [ ] Verify redirect URI mismatch, login cancellation, unavailable Keycloak, and unavailable Mirage behavior.
- [ ] Verify SSO disabled in development and production-like configuration; ensure production never becomes anonymous.
- [ ] Verify CORS, TLS trust, secret exposure, and log redaction.
- [ ] Review callback/open-redirect handling and role mapping with the security/Infra owner.

**Exit condition:** implementation checks pass in CI and a staging environment before production rollout.

### Phase 6 — Rollout and operations

- [ ] Register the final redirect URIs/origins and deploy environment-specific configuration.
- [ ] Enable first in development, then staging with Infra/Mirage owners available for troubleshooting.
- [ ] Validate with representative accounts: no role, read-only role, editor role, and admin role if available.
- [ ] Confirm monitoring distinguishes login failures, token validation failures, role-service failures, and provider/network outages without logging secrets.
- [ ] Document support ownership, outage procedure, switch procedure, and recovery procedure.
- [ ] Enable production only after staging sign-off and a tested rollback/disable procedure.

## 8. Acceptance criteria

- A signed-out user can choose “Log in with SSO” from the entry experience.
- A successful Keycloak sign-in returns the user to the application with the expected identity and permissions.
- The API independently validates tokens and enforces the agreed route/role policy.
- Invalid, expired, wrong-issuer, or wrong-audience tokens are rejected.
- The app handles logout and login/provider errors without redirect loops or token leakage.
- Environment-specific URLs and configuration are separated; no secret is committed or exposed to the frontend.
- Setting SSO disabled produces the documented outage/maintenance behavior and never grants anonymous access to protected API routes in production.
- Infra and the project team have approved the role mapping, outage behavior, and production configuration.

## 9. Risks and dependencies

| Risk/dependency | Mitigation / owner action |
|---|---|
| Realm/issuer or proxy path is unknown | Infra supplies and verifies the discovery URL and issuer before implementation. |
| Redirect URLs differ across environments | Project/deployment owner supplies exact URLs; register exact values per environment. |
| Mirage contract is not finalized | Mirage team supplies endpoint/auth/schema or project chooses Keycloak role claims. |
| Tunnel certificate is not trusted by local/runtime environment | Infra provides the CA chain and setup instructions; do not disable TLS verification. |
| Keycloak outage is mistaken for permission to bypass auth | Define SSO switch semantics and preserve server-side denial for protected routes. |
| Frontend-only access controls are bypassed | Enforce identity and role authorization in Express middleware. |
| Existing project spec says frontend exchanges credentials | Use an OIDC redirect flow; the app must not collect or handle users’ Keycloak passwords. |

## 10. Project references

- `COBRA.md` — intended Keycloak JWT integration, environment-variable draft, role matrix, and pending Mirage endpoint.
- `backend/src/index.ts` — Express middleware and route registration point.
- `backend/src/config.ts` — backend environment configuration.
- `backend/.env.example` — local backend environment template.
- `frontend/src/lib/api.ts` — shared API request helper to integrate authenticated requests if the selected architecture sends bearer tokens from the browser.
- `frontend/src/App.tsx` — frontend route structure to review for login/callback routing.

