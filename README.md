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

| Environment | URL                          |
| ----------- | ---------------------------- |
| Local       | http://localhost:3000        |
| Staging     | https://stage.amplifyhope.cc |
| Production  | https://amplifyhope.cc       |

The API base URL is set via `NEXT_PUBLIC_API_BASE_URL` at build time.

## Testing

```bash
yarn test:unit     # Mocha unit tests
yarn typecheck     # tsc --noEmit
yarn lint          # ESLint
```

## Deployment

Deployed via GitLab CI (`.gitlab-ci.yml`). Pipelines are triggered on pushes to `main`.

| Stage             | Trigger          | What it does                                           |
| ----------------- | ---------------- | ------------------------------------------------------ |
| test              | auto             | unit tests + Snyk scan                                 |
| build:staging     | auto (main only) | Docker build with staging env vars, push to Docker Hub |
| deploy:staging    | auto (main only) | SSH to stage EC2, pulls image, restarts container      |
| build:production  | manual           | Docker build with prod env vars, push to Docker Hub    |
| deploy:production | manual           | SSH to prod EC2, pulls image, restarts container       |

Containers run with `--restart unless-stopped` so they survive EC2 reboots.

After each deploy, `docker image prune -af` runs to prevent disk accumulation.

**Note:** Environment variables (`NEXT_PUBLIC_*`) are baked into the image at build time — staging and production require separate build stages with their respective env vars.

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
| `services/checkout.ts`                 | API client for checkout endpoints        |
| `next.config.js`                       | Standalone output, Sentry webpack plugin |

## Links

- [API repo](https://gitlab.com/amplifyhope/ah-website-api)
- [Docker Hub](https://hub.docker.com/r/agiannellah/ah-web-ui)
- [Amplify Hope](https://amplifyhope.cc)
