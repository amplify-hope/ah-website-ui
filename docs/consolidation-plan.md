# Consolidate `ah-website-api` into `ah-website-ui`

Jira Epic: [WEB-20](https://amplifyhope.atlassian.net/browse/WEB-20)

## Goal

Consolidate the `ah-website-api` Express microservice into the `ah-website-ui` Next.js 15 app so the donation platform is a single, unified codebase and deployment. Driven by one engineer finding the microservice split slows development more than it helps.

## Decision Log

| Decision                           | Choice                                                                                                                                                   | Why                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Consolidation direction            | Port Express controllers into Next.js Route Handlers inside `ah-website-ui`                                                                              | Single deployable, single repo, no cross-service network hop                                                                                                                                                                                                                                                                               |
| `stripe_products` Postgres table   | Drop entirely — no database at all post-migration                                                                                                        | Table is write-only today (webhook upserts, nothing reads it); dropping it removes RDS hosting, `pg`/connection pooling, and an entire failure mode                                                                                                                                                                                        |
| Cutover strategy                   | Big-bang — build the full replacement, verify, then switch over once                                                                                     | Small surface (8 routes, no DB reads to reconcile) makes an incremental strangler pattern pure coordination overhead for a solo engineer                                                                                                                                                                                                   |
| Auth/session scope                 | Preserve exact current behavior: JWT-verified magic link → redirect straight to a Stripe-hosted Billing Portal session. No new app-level session/cookie. | Avoids scope creep into a new "logged in" experience; this migration is about consolidation, not new features                                                                                                                                                                                                                              |
| `services/donations.ts` (frontend) | Delete — it calls `/donations` and `/donations/:userId`, which do not exist anywhere in `ah-website-api`                                                 | Dead/aspirational code with zero callers found in the app                                                                                                                                                                                                                                                                                  |
| Testing rigor for new routes       | Add route-level integration tests for every new Route Handler, in addition to existing unit-test conventions                                             | Webhook signature verification and raw-body handling are genuinely new, risky surface area                                                                                                                                                                                                                                                 |
| Hosting platform                   | AWS Amplify Hosting (replacing per-app EC2 + Docker + nginx + certbot)                                                                                   | Nonprofit AWS credits only offset AWS spend; traffic is low so a platform with near-zero idle cost and zero server/container ops fits best. Amplify has first-class Next.js App Router Route Handler support, including raw-body Stripe webhook handling                                                                                   |
| CI/CD                              | Move build+deploy into Amplify's own git-triggered pipeline (`amplify.yml`); GitLab CI reduced to lint/test gates or retired                             | Avoids maintaining two parallel deploy pipelines; Amplify connects natively to GitLab.com SaaS repos                                                                                                                                                                                                                                       |
| `ah-website-api` repo/host fate    | Archive the repo (read-only) and decommission its EC2 host after a soak period confirms the merged app is stable                                         | Keeps history for reference without carrying ongoing cost or maintenance burden                                                                                                                                                                                                                                                            |
| Stripe SDK version                 | Use `stripe` ^23.0.0 in `ah-website-ui` (matches `ah-website-api`). `@stripe/stripe-js` stays where it is.                                               | With no `apiVersion` pinned the SDK sends its own pinned API version: v23.0.0 pins `2026-09-30.endive`, v17.7.0 pinned `2025-02-24.acacia`. Staying on v17 would change Stripe behavior vs. today's API. Newer `@stripe/stripe-js` releases removed `redirectToCheckout`, so that package is not bumped without switching to `session.url` |
| Webhook endpoint shape             | Single endpoint, single `STRIPE_WEBHOOK_SECRET`, no `?version=` dual-endpoint guard                                                                      | The Stripe API-version webhook migration is already complete on staging and production, so `STRIPE_WEBHOOK_SECRET_NEXT`, `STRIPE_WEBHOOK_ACTIVE_VERSION` and `webhook-version.ts` are not ported. The production webhook endpoint is currently disabled                                                                                    |

## Current vs. Target Architecture

|             | Today                                                                                                               | Target                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Services    | Two repos, two EC2 hosts/containers: `ah-website-ui` (Next.js, port 3000) and `ah-website-api` (Express, port 3002) | One repo, one Amplify Hosting app                                                        |
| API surface | Express routes behind CORS, called via `NEXT_PUBLIC_API_BASE_URL`                                                   | Next.js Route Handlers under `app/api/*`, called via same-origin relative paths          |
| Data store  | Postgres (RDS) with one write-only table                                                                            | None — fully stateless, live Stripe API calls                                            |
| Auth        | Magic-link JWT → Stripe Billing Portal redirect (Express)                                                           | Identical flow, implemented as two Route Handlers                                        |
| Deploy      | GitLab CI → Docker Hub → SSH+Docker run on EC2, per app                                                             | Git push → Amplify Hosting build/deploy, per branch/environment                          |
| Env/secrets | Docker build ARGs (frontend) + `.env` file on host (backend)                                                        | Amplify Console environment variables, server secrets never exposed to the client bundle |

## Phased Plan

Tracked in Jira as Stories under Epic [WEB-20](https://amplifyhope.atlassian.net/browse/WEB-20).

### [WEB-21] Foundations & Config

- [ ] A1. Add a server-only env var module (e.g. `lib/env.ts`, Yup-validated, consistent with the existing Formik/Yup usage) for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`. Drop obsolete backend vars: `DBHOST/DBUSER/DBDATABASE/DBPASSWORD/DBPORT`, `NEW_RELIC_APP_NAME/NEW_RELIC_LICENSE_KEY` (confirmed unused in source), `API_BASE_URL`, and `STRIPE_RECURRING_PRODUCT_ID` (confirmed unused: defined in `ah-website-api` config/types/`.env.example` but never read). Do **not** port `STRIPE_WEBHOOK_SECRET_NEXT` / `STRIPE_WEBHOOK_ACTIVE_VERSION` (migration complete; single `STRIPE_WEBHOOK_SECRET` only).
- [ ] A2. Add new dependencies: `jsonwebtoken`, `@types/jsonwebtoken`, `resend`. **Upgrade `stripe` from ^17.7.0 to ^23.0.0** to match `ah-website-api` (the two repos do not currently match). v23 only exports `Stripe` as a type from the named import, so use `import Stripe from 'stripe'`. Do not bump `@stripe/stripe-js`.
- [ ] A3. Create a shared server-side Stripe client singleton (e.g. `utils/stripe-server.ts`), replacing the per-controller `new Stripe(...)` pattern from `ah-website-api`.
- [ ] A4. Consolidate the duplicated fee logic: backend's `formatAmountForStripe` and frontend's `calculateStripeFees` (`utils/stripe-helpers.ts`) into one canonical implementation. Extend the existing unit test (`utils/test/stripe-helpers.unit.ts`) with the backend's `formatAmountForStripe(1.239, 'usd') -> 124` case.
- [ ] A5. **Deferred to WEB-23 (do after C4).** Trim `common/types/index.ts`: remove `Donation`/`User` fields that only existed to support the dead donations feature, once `services/donations.ts` is deleted and no usages remain.

### [WEB-22] Port API routes into Next.js Route Handlers

- [ ] B1. `app/api/products/[type]/route.ts` (GET) — port `getProducts` (live Stripe product search by metadata). **Validate `:type` against an allow-list** before using it in the Stripe `products.search` query (the Express handler currently interpolates it unvalidated)
- [ ] B2. `app/api/checkout/route.ts` (POST) — port `postCheckoutSession` (amount validation, price lookup/create, checkout session create). Return 403 when a recurring donation has no interval (matches the recent API fix; the old `return res.status(403)` never sent a response)
- [ ] B3. `app/api/checkout-sessions/[id]/route.ts` (GET) — port `getCheckoutSessionById`
- [ ] B4. `app/api/create-portal-session/route.ts` (POST) — port `createPortalSession`
- [ ] B5. `app/api/login/route.ts` (POST) — port `loginHandler` + `sendMagicLink` (Resend email)
- [ ] B6. `app/api/verify/route.ts` (GET) — port `verifyMagicLink` (JWT verify → Stripe Billing Portal session → `NextResponse.redirect`)
- [ ] B7. `app/api/stripe-webhooks/route.ts` (POST) — port `stripeWebhooks`; use `req.text()` for raw-body signature verification; **single endpoint with a single `STRIPE_WEBHOOK_SECRET`, no `?version=` guard**; **return 400 on an invalid signature** (the Express handler's catch currently sends no response); drop the `product.created/updated/deleted` DB-sync branches entirely (no DB); keep invoice/payment-intent/charge logging branches
- [ ] B8. Decide fate of `/health` and `/debug-sentry`: recommend dropping both unless a lightweight uptime check is wanted
- [ ] B9. Remove the `cors` package/middleware entirely — all calls become same-origin

### [WEB-23] Frontend rewiring to same-origin API calls

- [ ] C1. Replace every `NEXT_PUBLIC_API_BASE_URL` call with a relative `/api/...` path: `components/auth/login-with-email.tsx`, `components/checkout/CheckoutForm.tsx` (both the SWR fetch and the POST), `services/checkout.ts`
- [ ] C2. Standardize `CheckoutForm.tsx`'s SWR fetcher on `fetchJson` instead of `axios`; drop the `axios` dependency if nothing else uses it
- [ ] C3. Fix the latent bug in `CheckoutForm.tsx` (~line 113): guard against `error` being `undefined` after a successful `redirectToCheckout` before reading `error.message`
- [ ] C4. Delete `services/donations.ts` and confirm no remaining imports
- [ ] C5. Remove `NEXT_PUBLIC_API_BASE_URL` from `.env.example`, `config/`, and any remaining references

### [WEB-24] Testing: route-level integration coverage

- [ ] D1. Establish a Route Handler integration-test pattern: import the route module's exported `GET`/`POST` and invoke directly with constructed `Request` objects (no server/supertest needed). Add a `*.integration.ts` glob alongside the existing `*.unit.ts` Mocha convention.
- [ ] D2. Integration tests for `/api/checkout`: happy path (one-time and recurring), amount below/above `MIN_AMOUNT`/`MAX_AMOUNT` rejected
- [ ] D3. Integration tests for `/api/stripe-webhooks`: valid signature for each handled event type, invalid signature returns 400
- [ ] D4. Integration tests for `/api/login`: known Stripe customer → 204, unknown email → 404
- [ ] D5. Integration tests for `/api/verify`: valid token → redirect to Billing Portal, expired/invalid token → 401
- [ ] D6. Reconcile the existing `stripe-helpers.unit.ts` test with the consolidated helper from A4

### [WEB-25] Security & cleanup

- [ ] E1. Reconcile the `resolutions` blocks from both `package.json` files when merging dependencies
- [ ] E2. Drop `@sentry/node` + `@sentry/profiling-node` (Express-specific); confirm `@sentry/nextjs` auto-captures Route Handler errors with no manual wiring needed
- [ ] E3. Remove `docker-compose.yml` and `src/init-db/` from the merged codebase (no DB)

### [WEB-26] Infrastructure: migrate to AWS Amplify Hosting

- [ ] F1. Provision an AWS Amplify Hosting app connected to the `ah-website-ui` GitLab.com repo
- [ ] F2. Configure branch/environment mapping mirroring today's gate: `main` → staging (auto-deploy), a manual-promote step or protected branch → production
- [ ] F3. Write `amplify.yml` build spec: install → lint → typecheck → `test:unit` → `test:integration` → build
- [ ] F4. Migrate environment variables into Amplify Console per branch: existing `NEXT_PUBLIC_*` vars plus new server secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET` — must carry over the exact current value so in-flight magic links don't break —, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`)
- [ ] F5. Spike: verify `next.config.js`'s `output: 'standalone'` setting (Docker-specific) against Amplify's Next.js compute integration; adjust as needed before porting all routes
- [ ] F6. Configure custom domain + managed SSL in Amplify, replacing certbot/nginx on the old EC2 host
- [ ] F7. Decide and implement the final shape of `.gitlab-ci.yml`: reduce to lint/test-only gates (recommended) or retire in favor of `amplify.yml` running everything
- [ ] F8. Remove the `Dockerfile` once Amplify deploys are verified working end-to-end

### [WEB-27] Cutover & decommission old infrastructure

- [ ] G1. Register the new Amplify URL as a Stripe webhook endpoint (staging first) and verify signature validation against real test events before relying on it. The production webhook endpoint is currently **disabled** (it was disabled before the Stripe API-version migration), so there is no live production endpoint to run in parallel; the Amplify production endpoint will be the first enabled one. Staging and production API-version migrations are already complete
- [ ] G2. Confirm Resend sending domain/DNS is unaffected by the infra move
- [ ] G3. DNS cutover: point the production domain at Amplify's custom domain
- [ ] G4. Soak period: monitor Sentry + Amplify logs for 48–72 hours post-cutover before decommissioning anything
- [ ] G5. Decommission the old `ah-website-ui` EC2/Docker deployment
- [ ] G6. Decommission the `ah-website-api` EC2 host/container; archive (read-only) the `ah-website-api` GitLab repo
- [ ] G7. Update `ah-website-ui`'s `README.md` and `CLAUDE.md` to reflect the consolidated architecture and Amplify deployment model

## Risks & Mitigations

| Risk                                                                                         | Mitigation                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amplify Hosting Next.js quirks (build size cap, response size cap, output mode) surface late | Front-load the F5 spike before porting all 8 routes, not after                                                                                                                                                                     |
| Stripe webhook setup during cutover                                                          | The production webhook endpoint is currently disabled, so there is no live production endpoint to run in parallel. Verify the new Amplify webhook endpoint against real test events in staging first, then enable it in production |
| Stripe SDK / API version drift                                                               | Port with `stripe` ^23 so the UI-hosted routes call the same API version as `ah-website-api` today; complete the Stripe test-mode pass (recurring checkout, portal login) before cutover                                           |
| `JWT_SECRET` mismatch breaks all in-flight (already-sent, unclicked) magic links             | Copy the exact current secret value into Amplify env vars rather than regenerating it                                                                                                                                              |
| Big-bang cutover has no incremental fallback if something's wrong                            | Route-level integration tests (WEB-24) before cutover, plus a defined soak period (G4) with the old infra kept warm enough to repoint DNS back if needed                                                                           |

## Definition of Done

- All 8 original API routes work identically (or are deliberately dropped, per B8) as Next.js Route Handlers
- No Postgres/RDS dependency remains in code or infra
- Frontend makes zero calls to `NEXT_PUBLIC_API_BASE_URL`
- Route-level integration tests exist and pass for checkout, webhooks, login, and verify
- App runs on AWS Amplify Hosting with custom domain, SSL, and both environments configured
- Stripe webhooks and magic-link emails verified working end-to-end against the Amplify-hosted app
- 48–72 hour soak period completed with no unresolved errors
- `ah-website-api` repo archived, its EC2 host decommissioned
- `ah-website-ui` README/CLAUDE.md updated to reflect the new architecture
