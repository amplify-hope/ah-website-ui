# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # start dev server with Turbopack on http://localhost:3000
yarn build        # production build
yarn start        # run the production server locally
yarn lint         # ESLint
yarn format       # Prettier --write on the whole repo; to only check, `npx prettier --check <paths>`
yarn typecheck    # tsc --noEmit
yarn test:unit    # Mocha unit tests (matches **/*.unit.ts)
yarn test:integration  # Mocha Route Handler tests (matches **/*.integration.ts)
```

Run a single unit test file:

```bash
NODE_ENV=development npx ts-mocha utils/test/stripe-helpers.unit.ts
```

Setup:

```bash
nvm install        # installs Node 24 from .nvmrc
yarn
cp .env.example .env.local  # fill values from a teammate
```

## Architecture

**Next.js 15 App Router** frontend for the Amplify Hope donation platform. React 19, TypeScript, Tailwind CSS, deployed via Docker to EC2.

### Directory layout

| Path              | Purpose                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`            | Next.js App Router pages and layouts; `app/api/*/route.ts` are the Route Handlers (one-line adapters)                                      |
| `components/`     | React components, organized by feature (`checkout/`, `auth/`, `layout/`, `common/`)                                                        |
| `services/`       | Browser clients for the same-origin API (`checkout`, `products`, `auth`), thin wrappers over `utils/api-client`                            |
| `lib/`            | Server code: `handlers/` (route logic), `deps.ts` (`serve`), `env.ts`, `magic-link.ts`, `donation.ts`; `types.ts` holds the exported types |
| `utils/`          | Shared utilities: `api-client`, `stripe-helpers`, `get-stripejs`, `validation-schema`                                                      |
| `common/types/`   | Request-body types shared by client and server (`DonationRequestBody`, `LoginWithEmailRequestBody`, `IntervalOptions`)                     |
| `config/index.ts` | App-wide constants: `CURRENCY`, `MIN_AMOUNT`, `MAX_AMOUNT`, Stripe fee modifiers                                                           |

### Data flow

1. Pages in `app/` compose components from `components/`
2. `CheckoutForm` loads funds through `services/products.ts` (SWR) and POSTs to `/api/checkout` through `services/checkout.ts`
3. `utils/api-client` (`requestJson`) throws `ApiError(message, status)` on any non-2xx, with `errors[0]` from the body as the message; it resolves with nothing on 204. `errorMessage(err)` shows a 4xx message as is and fixed copy for anything else, so the three screens that make requests (donate form, sign-in form, result page) show failures instead of staying silent
4. After a successful checkout POST, the form redirects to Stripe Checkout via `stripe.redirectToCheckout`
5. `services/` holds the browser API clients; add new client calls there

### Key patterns

- **SWR** is used for data fetching in components (e.g., loading Stripe products in `CheckoutForm`)
- **Formik + Yup** handle all form state and validation; schemas live in `utils/validation-schema.ts`
- **Auth** uses magic-link email (no password); the sign-in flow sends an email, the user lands on `/auth/verify`
- **Stripe fees** are calculated client-side using `calculateStripeFees` from `utils/stripe-helpers.ts` with constants from `config/index.ts`
- Components are re-exported through barrel `index.ts` files in each `components/` subdirectory

### Server (Route Handlers)

- A `route.ts` may only export HTTP verbs, so each is `export const POST = serve(handleX)`; the logic is `handleX(req, deps, ctx)` in `lib/handlers/`
- `deps` is `{ stripe, env }` (`serveWithEmail` adds `resend`), built from `getStripe()` and `getServerEnv()`, both lazy so `next build` needs no secrets
- Errors are `jsonError(status, message)` → `{ errors: [message] }`; unexpected throws become a logged 500 via `withErrorHandling`
- Redirect URLs come from `CLIENT_BASE_URL`, never the `Origin` header
- Magic link: `/api/login` emails a 10 minute HS256 JWT, `/api/verify` redirects to a Stripe billing portal session

### Testing

- `lib/test/helpers.ts` has `fakeStripe`, `fakeResend`, `firstArg`, `jsonRequest`; `utils/test/fetch-stub.ts` has `stubFetch` and `stubFetchFailure`. Tests never touch the network
- Import with relative paths in anything a mocha test loads
- Runbook for a real sandbox pass: `docs/stripe-testing.md`

### Conventions

- Exported types live in `lib/types.ts`; avoid `unknown` and `any` (use `JsonValue`, SDK types)
- Keep markdown changes in their own commit: the pre-commit hook reformats every file when `.ts` files are staged

### Styling

Tailwind CSS with a custom palette. Key custom colors: `ahBlue` (#0059a1), `ahGray` (#79777a), `primary-*` (teal scale), `secondary-500` (green), `errorColor-*`. Fonts: `font-heading` (Montserrat Alternates), `font-subheading` (Montserrat), `font-body` (Roboto) — all loaded via `next/font/google` in `app/layout.tsx`.

### Environment variables

`NEXT_PUBLIC_*` variables are baked into the Docker image at build time, so staging and production require separate builds. Server-only variables (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_TEMPLATE_ID`, `CLIENT_BASE_URL`) are validated in `lib/env.ts` and read per request: `.env.local` locally, `~/.env/.ah-ui.env` on the EC2 hosts (`--env-file`, `KEY=value`, no quotes).

### Deployment

GitLab CI pipeline, triggered by merges to `develop`: `test:unit` → `amplify:staging` (auto) → `smoke:staging` → `amplify:production` (manual) → `smoke:production`. Feature branches are cut from `develop`. `main` is the production branch and is managed by CI: `amplify:production` fast-forwards it to the tested commit before building Amplify `main`, so never push to it. The Docker and SSH jobs (`build:*`, `deploy:*`) stay until the DNS cutover. ESLint is suppressed during Next.js builds (`ignoreDuringBuilds: true` in `next.config.js`); lint runs in the pre-commit hook, not in CI.

Each deploy job exits before stopping the running container if `~/.env/.ah-ui.env` is missing.

Sentry is configured for error tracking with 10% trace sampling. Source maps are uploaded via the Sentry webpack plugin using `SENTRY_AUTH_TOKEN`. Server-side Sentry loads from `instrumentation.ts` (keyed on `NEXT_RUNTIME`). `withErrorHandling` reports caught errors with `Sentry.captureException`, since Next's `onRequestError` never sees them. `lib/sentry.ts` holds the shared options and strips request bodies, cookies, query strings and user info from events, because these routes handle donor emails. Events carry `NEXT_PUBLIC_APP_ENV` as the environment.
