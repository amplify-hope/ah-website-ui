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

Server-only variables (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`) are read when a request arrives, not at build time. Locally they come from `.env.local`; on Amplify they come from a Secrets Manager secret (see Deployment). The legacy EC2 hosts read `~/.env/.ah-ui.env` until they are decommissioned.

## Testing

```bash
yarn test:unit         # Mocha unit tests
yarn test:integration  # Route Handler tests with fake Stripe and Resend clients
yarn typecheck         # tsc --noEmit
yarn lint          # ESLint
```

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). Cut feature branches from `develop` and merge them back into it; a merge to `develop` triggers the pipeline and deploys staging. `main` is the production branch and is managed by CI: the manual production job fast-forwards it to the commit that passed staging, so never push to it by hand.

The Amplify jobs deploy to AWS Amplify Hosting, which serves both domains. The Docker and SSH jobs keep the old EC2 hosts current as a rollback until the soak ends and they are removed (WEB-26 F8, WEB-27).

| Stage              | Trigger                  | What it does                                                          |
| ------------------ | ------------------------ | --------------------------------------------------------------------- |
| test               | auto                     | unit + integration tests, Snyk scan                                   |
| amplify:staging    | auto (develop only)      | Push variables to Amplify branch `develop`, build, wait for it        |
| smoke:staging      | auto (develop only)      | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |
| amplify:production | manual                   | Fast-forward `main` to this commit, build Amplify branch `main`, wait |
| smoke:production   | after amplify:production | GET `/api/products/one-time` on `SMOKE_URL`, expect 200               |
| build:staging      | auto (develop only)      | Docker build with staging env vars, push to Docker Hub                |
| deploy:staging     | auto (develop only)      | SSH to stage EC2, pulls image, restarts container                     |
| build:production   | manual                   | Docker build with prod env vars, push to Docker Hub                   |
| deploy:production  | manual                   | SSH to prod EC2, pulls image, restarts container                      |

**Note:** Environment variables (`NEXT_PUBLIC_*`) are inlined at build time, so staging and production are separate builds. `scripts/amplify-deploy.sh` pushes them from the GitLab CI variables to the Amplify branch with `update-branch`, which replaces the whole variable map, so anything set by hand in the Amplify console is overwritten on the next deploy.

Server-only variables are not baked in. On Amplify they live in one Secrets Manager secret per environment (`ah-website/staging`, `ah-website/production`), named by `AH_SECRET_ID` and read through a per-branch compute role. `CLIENT_BASE_URL` is that site's own origin, and `JWT_SECRET` must stay the same across deploys or magic links already emailed stop working.

The legacy hosts keep their variables in `~/.env/.ah-ui.env` (`KEY=value` lines, no quotes, `chmod 600`) and the Docker deploy starts the container with `--env-file ~/.env/.ah-ui.env`; the job checks the file exists before it stops the running container. Containers run with `--restart unless-stopped`, and `docker image prune -af` runs after each deploy. All of this goes away with the Docker jobs.

## Infrastructure

| Resource      | Details                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hosting       | AWS Amplify Hosting (SSR compute), app `ah-website` in us-west-2; branch `develop` is staging, `main` is production      |
| Domains / TLS | Route 53 zone `amplifyhope.cc`; `stage.amplifyhope.cc` → `develop`, apex and `www` → `main`; Amplify-managed certificate |
| Secrets       | Secrets Manager `ah-website/staging` and `ah-website/production`, read through a per-branch compute role                 |
| CI to AWS     | GitLab OIDC role `ah-website-ci-deploy` (no static keys)                                                                 |
| Output        | Default `.next` output on Amplify                                                                                        |

**Legacy, until WEB-26 F8 and WEB-27 remove it:** one EC2 instance per environment running a Docker container behind nginx with certbot TLS, with the image in Docker Hub (`agiannellah/ah-web-ui`) built in `standalone` mode. It no longer receives traffic and is kept as a rollback. certbot cannot renew while the domains point at Amplify, so do not rely on it for long.

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
- [Docker Hub](https://hub.docker.com/r/agiannellah/ah-web-ui) (legacy)
- [Amplify Hope](https://amplifyhope.cc)
