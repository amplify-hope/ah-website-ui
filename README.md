# Amplify Hope Website

Next.js 15 (App Router) site for the Amplify Hope donation platform. Visitors give one-time or recurring (monthly, quarterly or yearly) donations through Stripe Checkout, and donors sign in with an emailed magic link to manage their giving in the Stripe billing portal. The pages and the API live in this one app.

## Getting started

You need `nvm` and `yarn`, plus the values for `.env.local` from a teammate. Use Stripe **test-mode** keys locally.

```bash
nvm install                 # installs Node 24 from .nvmrc
yarn                        # install dependencies
cp .env.example .env.local  # fill in values from a teammate
yarn dev                    # starts on http://localhost:3000
```

| Command                 | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `yarn dev`              | Dev server with Turbopack                                                       |
| `yarn build`            | Production build                                                                |
| `yarn start`            | Run the production build locally                                                |
| `yarn lint`             | ESLint                                                                          |
| `yarn format`           | Prettier `--write` on the whole repo                                            |
| `yarn typecheck`        | `tsc --noEmit`                                                                  |
| `yarn test:unit`        | Mocha unit tests (`**/*.unit.ts`)                                               |
| `yarn test:integration` | Route Handler tests with fake Stripe and Resend clients (`**/*.integration.ts`) |

## Environments

| Environment | URL                            |
| ----------- | ------------------------------ |
| Local       | <http://localhost:3000>        |
| Staging     | <https://stage.amplifyhope.cc> |
| Production  | <https://amplifyhope.cc>       |

The donation API lives in this app under `app/api/*` and is called with same-origin paths, so there is no API base URL.

There are two kinds of variables:

- **Build-time** (`NEXT_PUBLIC_*`, `SENTRY_AUTH_TOKEN`, `AH_SECRET_ID`, `AH_AWS_REGION`): set as GitLab CI variables per environment and inlined into the bundle, so staging and production are separate builds.
- **Server-only** (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`): read when a request arrives, never at build time. Locally they come from `.env.local`; on Amplify they come from a Secrets Manager secret (see Deployment).

## Testing

```bash
yarn test:unit
yarn test:integration
yarn typecheck
NODE_ENV=development npx ts-mocha lib/test/env.unit.ts   # a single test file
```

Tests never touch the network: Stripe and Resend are injected fakes (`lib/test/helpers.ts`). For a real sandbox pass, including a test-clock renewal, follow [docs/stripe-testing.md](docs/stripe-testing.md).

## Contributing

- Cut a branch from `develop` named `web-NN/short-name`, prefix commit messages with the ticket (`WEB-NN: ...`), and merge through a merge request into `develop`.
- A pre-commit hook runs `yarn lint` and `yarn format` on staged `.ts`/`.tsx` files, and `yarn format` rewrites the whole repo. A pre-push hook runs `yarn typecheck`. Keep markdown changes in their own commit so the hook does not reformat unrelated files into them.
- Each release adds an entry to [ReleaseNotes.md](ReleaseNotes.md) and bumps `version` in `package.json`.

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). A merge to `develop` triggers the pipeline and deploys staging. `main` is the production branch and is managed by CI: the manual production job fast-forwards it to the commit that passed staging, so never push to it by hand.

The deploy jobs push to AWS Amplify Hosting, which serves both domains.

| Stage             | Trigger                 | What it does                                                          |
| ----------------- | ----------------------- | --------------------------------------------------------------------- |
| test              | auto                    | unit + integration tests, Snyk scan                                   |
| deploy:staging    | auto (develop only)     | Push variables to Amplify branch `develop`, build, wait for it        |
| smoke:staging     | auto (develop only)     | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |
| deploy:production | manual                  | Fast-forward `main` to this commit, build Amplify branch `main`, wait |
| smoke:production  | after deploy:production | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |

`scripts/amplify-deploy.sh` pushes the build-time variables from the GitLab CI variables to the Amplify branch with `update-branch`, which replaces the whole variable map, so anything set by hand in the Amplify console is overwritten on the next deploy.

Server-only variables live in one Secrets Manager secret per environment (`ah-website/staging`, `ah-website/production`), named by `AH_SECRET_ID` and read through a per-branch compute role. `CLIENT_BASE_URL` is that site's own origin, and `JWT_SECRET` must stay the same across deploys or magic links already emailed stop working.

### Rolling back

There is no separate fallback host. To undo a bad release, revert the change on a branch off `develop`, merge it, and run `deploy:production` from the new pipeline. Re-running the production job from an older pipeline fails by design, because the push to `main` must be a fast-forward. `aws amplify start-job --job-type RELEASE` on `main` rebuilds the current head of `main` only, so it retries a build but does not undo a commit.

## Infrastructure

| Resource      | Details                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting       | AWS Amplify Hosting (SSR compute), app `ah-website` in us-west-2; branch `develop` is staging, `main` is production                       |
| Domains / TLS | Route 53 zone `amplifyhope.cc`; `stage.amplifyhope.cc` → `develop`, apex and `www` → `main`; Amplify-managed certificate                  |
| Secrets       | Secrets Manager `ah-website/staging` and `ah-website/production`, read through a per-branch compute role                                  |
| CI to AWS     | GitLab OIDC role `ah-website-ci-deploy` (no static keys); only pipelines on `develop` can assume it                                       |
| Monitoring    | CloudWatch alarm `ah-website-5xx` and an AWS Budget alert, both emailing the ops address; UptimeRobot for reachability; Sentry for errors |
| Logs          | CloudWatch log group `/aws/amplify/d3504c7prom3aa`, 90-day retention                                                                      |

## Architecture

- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS with custom `ahBlue`/`ahGray` palette
- **Forms:** Formik + Yup validation
- **Error tracking:** Sentry (10% trace sampling, no session replay)

### Key files

| Path                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `app/donate/page.tsx`                  | Core donation flow                                        |
| `components/checkout/CheckoutForm.tsx` | Stripe checkout form with fee calculator                  |
| `app/api/*/route.ts`                   | Route Handlers (thin adapters)                            |
| `lib/handlers/*.ts`                    | Route logic, tested in `lib/test/`                        |
| `lib/env.ts`, `lib/secrets.ts`         | Server variable validation and the Secrets Manager reader |
| `lib/sentry.ts`                        | Shared Sentry options and the scrubber for donor data     |
| `services/*.ts`                        | Browser clients for the same-origin API                   |
| `next.config.js`                       | Security headers, Sentry webpack plugin                   |
| `amplify.yml`                          | Amplify build spec                                        |

## Links

- [Release notes](ReleaseNotes.md)
- [Stripe testing runbook](docs/stripe-testing.md)
- [Consolidation plan and decision log](https://amplifyhope.atlassian.net/wiki/spaces/Technology/pages/98311) (Confluence, WEB-20)
- [API repo](https://gitlab.com/amplifyhope/ah-website-api) (archived; the API now lives in this app)
- [Amplify Hope](https://amplifyhope.cc)
