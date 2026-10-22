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

Server-only variables (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`) are read when a request arrives, not at build time. Locally they come from `.env.local`; on the EC2 hosts they come from `~/.env/.ah-ui.env` (see Deployment).

## Testing

```bash
yarn test:unit         # Mocha unit tests
yarn test:integration  # Route Handler tests with fake Stripe and Resend clients
yarn typecheck         # tsc --noEmit
yarn lint          # ESLint
```

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). Cut feature branches from `develop` and merge them back into it; a merge to `develop` triggers the pipeline and deploys staging. `main` is the production branch and is managed by CI: the manual production job fast-forwards it to the commit that passed staging, so never push to it by hand.

The Amplify jobs deploy to AWS Amplify Hosting. The Docker and SSH jobs keep the old EC2 hosts current until the DNS cutover (WEB-26).

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

Containers run with `--restart unless-stopped` so they survive EC2 reboots.

After each deploy, `docker image prune -af` runs to prevent disk accumulation.

**Note:** Environment variables (`NEXT_PUBLIC_*`) are baked into the image at build time — staging and production require separate build stages with their respective env vars.

Server-only variables are not baked in. Each host keeps them in `~/.env/.ah-ui.env` (`KEY=value` lines, no quotes, `chmod 600`) and the deploy starts the container with `--env-file ~/.env/.ah-ui.env`. The deploy job checks the file exists before it stops the running container, so a missing file fails the job instead of taking the site down. `CLIENT_BASE_URL` is that site's own origin, and `JWT_SECRET` must stay the same across deploys or magic links already emailed stop working. This is interim until the move to AWS Amplify (WEB-26).

## Infrastructure

| Resource      | Details                                                              |
| ------------- | -------------------------------------------------------------------- |
| Compute       | Single EC2 instance per environment (prod + stage), Docker container |
| Reverse proxy | nginx on the EC2 host, SSL via certbot/Let's Encrypt                 |
| Docker images | Docker Hub — `agiannellah/ah-web-ui`                                 |
| Output        | `standalone` mode — self-contained Node.js server (~50–80MB image)   |

## Architecture

- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS with custom `ahBlue`/`ahGray` palette
- **Forms:** Formik + Yup validation
- **Error tracking:** Sentry (10% trace sampling)
- **Analytics:** Google Analytics 4

### Key files

| Path                                   | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `app/donate/page.tsx`                  | Core donation flow                       |
| `components/checkout/CheckoutForm.tsx` | Stripe checkout form with fee calculator |
| `app/api/*/route.ts`                   | Route Handlers (thin adapters)           |
| `lib/handlers/*.ts`                    | Route logic, tested in `lib/test/`       |
| `services/*.ts`                        | Browser clients for the same-origin API  |
| `next.config.js`                       | Standalone output, Sentry webpack plugin |

## Links

- [API repo](https://gitlab.com/amplifyhope/ah-website-api)
- [Docker Hub](https://hub.docker.com/r/agiannellah/ah-web-ui)
- [Amplify Hope](https://amplifyhope.cc)
