# HANDOFF

Written 2026-11-12, to keep context that until now lived only in a coding assistant's per-machine memory and in session history. Both disappear with the machine they were built on. [`README.md`](README.md) covers setup, deployment and infrastructure, and [`CLAUDE.md`](CLAUDE.md) covers architecture and conventions. This file holds only what neither of them carries: why things are the way they are, and what is still owed.

The written record of the consolidation lives in Confluence — [page 98311](https://amplifyhope.atlassian.net/wiki/spaces/Technology/pages/98311) "Website Tech Stack Consolidation", with children 20414465 (the Amplify hosting design) and 22446082 — and in Jira project WEB. `docs/consolidation-plan.md` was deliberately removed from this repo on 2026-10-30; Confluence is the single copy.

## Where the work stands

Epic WEB-20 ported the Express `ah-website-api` into Route Handlers in this app. **WEB-21 through WEB-30 are all done**, including the post-cutover hardening; closing the epic itself is the only thing left on it. Both domains have served from Amplify since 2026-10-23 and the soak passed with no 5xx over roughly 29,000 requests. The most recent release is v2.11.0 (WEB-62, privacy and terms pages).

Still in the backlog:

- **WEB-31** — `/api/login` allows email enumeration.
- **WEB-32** — there is no Content-Security-Policy. `next.config.js` sets the other baseline headers.

One loose end from WEB-30: the scrubber strips `cloudfront-viewer-*` request headers (visitor IP and location were reaching Sentry) and a unit test covers it, but it has **not yet been confirmed in a live Sentry event**.

## Notes that are now stale — do not "fix" these again

Earlier context listed these as known gaps. All four were verified against the code on 2026-11-12 and are **already fixed**:

- Failed requests are no longer silent. `errorMessage()` in `utils/api-client` drives visible errors on all three screens that make requests.
- The sign-in form shows a failure in place and only navigates to `/auth/verify` after the request succeeds.
- The result page guards a failed session fetch with a `failed` flag and friendly copy; it does not render `$NaN`.
- Server-side Sentry initialises correctly. `instrumentation.ts` keys on `NEXT_RUNTIME` (an earlier version checked `NODE_RUNTIME`, which Next never sets).

## Decisions that look like mistakes and are not

- **`stripe` is pinned to ^23 and the API version to `2026-09-30.endive`**, matching what the old API used.
- **Do not bump `@stripe/stripe-js`.** Newer releases removed `redirectToCheckout`, which the donation flow depends on.
- **Environment validation uses Yup, not zod**, because the app already carries Formik and Yup.
- **The Stripe webhook route was dropped, not ported**, and `STRIPE_WEBHOOK_SECRET` was removed. Its only job was finalising recurring invoices, which Stripe does by itself about an hour later; the production endpoint was already disabled, and the old endpoints were deleted at decommission. It dated from the June 2022 recurring-donations work.
- **`create-portal-session`, `/health` and `/debug-sentry` were dropped too.**
- **Redirect URLs come from `CLIENT_BASE_URL`, never the `Origin` header.**
- **Route tests ship with each route**, as `handleX(req, deps, ctx)` in `lib/handlers/` with injected fakes from `lib/test/helpers.ts`.
- **Rollback goes forward.** There is no fallback host: the old Amplify and git `production` branches were deleted. Re-running an older pipeline's production job fails by design, because the push to `main` must be a fast-forward and `aws amplify start-job` only rebuilds the current head of `main`.

## What was decommissioned, and what is still owed

On 2026-10-30 both EC2 hosts (they served the UI and the API) were terminated, their Elastic IPs released, the `api` and `api-stage` A records deleted, and the RDS instance `ah-website` deleted. The judgement that no legitimate API callers remained rested on the CORS allowlist containing only the website's own origins. The old Stripe webhooks were deleted, the `ah-website-api` repo archived, and the `EC2_*` and `DOCKER_HUB_TOKEN` GitLab variables retired, along with six unused IAM roles and an orphan log group.

**The only copies of the old data are snapshots**, kept deliberately: one EBS snapshot per terminated host (staging and production), two RDS snapshots named `web-27-ah-website-<date>` and `web-27-ah-website-final-<date>`, and two older ones named for the staging and production Postgres instances. List them with `describe-snapshots --owner-ids self` and `describe-db-snapshots`. The intention was to **delete them after a few months — around February 2027.** Nothing will prompt you.

Two CloudFront distributions whose purpose was never identified, and some old Lambda@Edge log groups, were found during the decommission and deliberately left alone. They are still unexplained, so do not assume everything in the account is accounted for.

## Access and tooling

- **Verify the AWS account before every write.** `assume AmplifyHope/Engineering` (Granted SSO, `us-west-2`) has failed silently on occasion. When it does, the CLI falls back to default credentials — an IAM user in a **different account** — and the resulting "App not found" errors look like a broken Amplify app rather than a wrong-account problem. Three calls landed in the wrong account before this was noticed. Never discard `assume`'s output; run `aws sts get-caller-identity --query Account --output text` in the same shell and abort unless it prints the Amplify Hope account. The cause of the intermittent failure was never found.
- Write JSON to a file before parsing it — the `assume` banner pollutes stdout.
- Slow or timed-out network calls are usually corporate VPN and TLS inspection, not an outage. An `openssl s_client` showing an unexpected issuer is that proxy, not a compromised site.

## Conventions not in CLAUDE.md

- **Skip Snyk scans in this repo.** A global rule says to scan new first-party code; it is the employer's tooling and applies only to those repos. The Snyk steps were removed from the WEB-20 tickets, Confluence and the plan on 2026-10-14 — do not re-add them. Lint, typecheck and the unit tests still run.
- **One commit per route, shared code in its own commit**, each green on its own (typecheck, lint, unit, integration, build).
- **Keep markdown changes in their own commit.** The pre-commit hook runs `yarn format`, which is Prettier `--write` across the whole repo, so a markdown edit staged with `.ts` files drags unrelated reformatting into the diff. Use `npx prettier --check <paths>` to check without rewriting.
- Exported types live in `lib/types.ts`. Avoid `unknown` and `any`: use the named `JsonValue`, `instanceof Stripe.errors.StripeError` rather than casting, SDK types such as `CreateEmailOptions` for fakes, and a generic `firstArg<T>()` instead of casting call arguments.
- Testing follows Stripe's own guidance: fakes in CI, a dedicated sandbox for real behaviour, and test clocks for recurring donations. The runbook is [`docs/stripe-testing.md`](docs/stripe-testing.md).
- After `yarn build`, clear `.next/types` before running `yarn typecheck` on an older commit; stale generated route types fail otherwise.
- Merge requests are opened and merged by hand, not by the assistant.
