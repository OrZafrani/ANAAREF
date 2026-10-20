# COBRA security rules

Project rules for the security-guidance reviewer. Background: docs/security/README.md.

- Every SQL query uses `pg` placeholders (`$1..$n`). Never interpolate request data into SQL; dynamic
  column names must come from a fixed list in code, as in `services/templateService.ts`.
- Every route validates params, query and body with the helpers in `backend/src/lib/validate.ts`
  (`validateBody`, `validateParams`, `validateQuery`), so unknown fields are rejected.
- URLs stored in the database and rendered as links must be http(s) only: `vHttpUrl()` on the
  backend, `safeExternalUrl()` on the frontend. Links that open a new tab use `rel="noopener noreferrer"`.
- Never use `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` with data from the API
  or browser storage.
- Never set CORS to `*` or reflect arbitrary origins; allowed origins come from `CORS_ORIGINS`.
- Never disable TLS verification (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`);
  use `DATABASE_SSL_CA` for private certificates.
- Never commit `.env` files, credentials or connection strings with real passwords; examples use
  placeholders.
- Unhandled errors return a generic message; details go to the server log only.
- New write routes and run controls will need the permission check once authentication exists;
  do not add endpoints that bypass it.
