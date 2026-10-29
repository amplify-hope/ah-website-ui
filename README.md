# Amplify Hope Website

Next.js 15 frontend for the Amplify Hope donation platform.

## Getting Started

```bash
nvm install        # installs Node 24 from .nvmrc
yarn               # install dependencies
cp .env.example .env.local  # fill in values from a teammate
yarn dev           # starts on http://localhost:3000
```

## Environments

| Environment | URL                            |
| ----------- | ------------------------------ |
| Local       | <http://localhost:3000>        |
| Staging     | <https://stage.amplifyhope.cc> |
| Production  | <https://amplifyhope.cc>       |

The donation API lives in this app under `app/api/*` and is called with same-origin paths, so there is no API base URL.

Server-only variables (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`) are read when a request arrives, not at build time. Locally they come from `.env.local`; on Amplify they come from a Secrets Manager secret (see Deployment).

## Testing

```bash
yarn test:unit         # Mocha unit tests
yarn test:integration  # Route Handler tests with fake Stripe and Resend clients
yarn typecheck         # tsc --noEmit
yarn lint          # ESLint
```

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). Cut feature branches from `develop` and merge them back into it; a merge to `develop` triggers the pipeline and deploys staging. `main` is the production branch and is managed by CI: the manual production job fast-forwards it to the commit that passed staging, so never push to it by hand.

The deploy jobs push to AWS Amplify Hosting, which serves both domains.

| Stage             | Trigger                 | What it does                                                          |
| ----------------- | ----------------------- | --------------------------------------------------------------------- |
| test              | auto                    | unit + integration tests, Snyk scan                                   |
| deploy:staging    | auto (develop only)     | Push variables to Amplify branch `develop`, build, wait for it        |
| smoke:staging     | auto (develop only)     | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |
| deploy:production | manual                  | Fast-forward `main` to this commit, build Amplify branch `main`, wait |
| smoke:production  | after deploy:production | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |

**Note:** Environment variables (`NEXT_PUBLIC_*`) are inlined at build time, so staging and production are separate builds. `scripts/amplify-deploy.sh` pushes them from the GitLab CI variables to the Amplify branch with `update-branch`, which replaces the whole variable map, so anything set by hand in the Amplify console is overwritten on the next deploy.

Server-only variables are not baked in. On Amplify they live in one Secrets Manager secret per environment (`ah-website/staging`, `ah-website/production`), named by `AH_SECRET_ID` and read through a per-branch compute role. `CLIENT_BASE_URL` is that site's own origin, and `JWT_SECRET` must stay the same across deploys or magic links already emailed stop working.

## Infrastructure

| Resource      | Details                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hosting       | AWS Amplify Hosting (SSR compute), app `ah-website` in us-west-2; branch `develop` is staging, `main` is production      |
| Domains / TLS | Route 53 zone `amplifyhope.cc`; `stage.amplifyhope.cc` → `develop`, apex and `www` → `main`; Amplify-managed certificate |
| Secrets       | Secrets Manager `ah-website/staging` and `ah-website/production`, read through a per-branch compute role                 |
| CI to AWS     | GitLab OIDC role `ah-website-ci-deploy` (no static keys)                                                                 |

## Architecture

- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS with custom `ahBlue`/`ahGray` palette
- **Forms:** Formik + Yup validation
- **Error tracking:** Sentry (10% trace sampling, no session replay)

### Key files

| Path                                   | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `app/donate/page.tsx`                  | Core donation flow                       |
| `components/checkout/CheckoutForm.tsx` | Stripe checkout form with fee calculator |
| `app/api/*/route.ts`                   | Route Handlers (thin adapters)           |
| `lib/handlers/*.ts`                    | Route logic, tested in `lib/test/`       |
| `services/*.ts`                        | Browser clients for the same-origin API  |
| `next.config.js`                       | Security headers, Sentry webpack plugin  |

## Links

- [API repo](https://gitlab.com/amplifyhope/ah-website-api) (being archived, WEB-27)
- [Amplify Hope](https://amplifyhope.cc)
