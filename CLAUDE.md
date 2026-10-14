# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # start dev server with Turbopack on http://localhost:3000
yarn build        # production build
yarn start        # run the production server locally
yarn lint         # ESLint
yarn format       # Prettier (write)
yarn typecheck    # tsc --noEmit
yarn test:unit    # Mocha unit tests (matches **/*.unit.ts)
```

Run a single unit test file:

```bash
NODE_ENV=development npx ts-mocha utils/stripe-helpers.unit.ts
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

| Path              | Purpose                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `app/`            | Next.js App Router pages and layouts                                                           |
| `components/`     | React components, organized by feature (`checkout/`, `auth/`, `layout/`, `common/`)            |
| `services/`       | API client functions (thin wrappers over `utils/fetchJson`)                                    |
| `utils/`          | Shared utilities: `fetchJson`, `alerts`, `stripe-helpers`, `get-stripejs`, `validation-schema` |
| `common/types/`   | Shared TypeScript types (`Donation`, `User`, `DonationRequestBody`, etc.)                      |
| `config/index.ts` | App-wide constants: `CURRENCY`, `MIN_AMOUNT`, `MAX_AMOUNT`, Stripe fee modifiers               |

### Data flow

1. Pages in `app/` compose components from `components/`
2. `CheckoutForm` (the core donation UI) calls `NEXT_PUBLIC_API_BASE_URL` endpoints directly via `utils/fetchJson`
3. `utils/fetchJson` integrates with `utils/alerts` (RxJS Subject-based) to surface success/error toasts automatically
4. After a successful checkout POST, the form redirects to Stripe Checkout via `stripe.redirectToCheckout`
5. `services/` contains typed wrappers for the API (donations, checkout); these are the right place to add new API calls

### Key patterns

- **SWR** is used for data fetching in components (e.g., loading Stripe products in `CheckoutForm`)
- **Formik + Yup** handle all form state and validation; schemas live in `utils/validation-schema.ts`
- **Auth** uses magic-link email (no password); the sign-in flow sends an email, the user lands on `/auth/verify`
- **Stripe fees** are calculated client-side using `calculateStripeFees` from `utils/stripe-helpers.ts` with constants from `config/index.ts`
- Components are re-exported through barrel `index.ts` files in each `components/` subdirectory

### Styling

Tailwind CSS with a custom palette. Key custom colors: `ahBlue` (#0059a1), `ahGray` (#79777a), `primary-*` (teal scale), `secondary-500` (green), `errorColor-*`. Fonts: `font-heading` (Montserrat Alternates), `font-subheading` (Montserrat), `font-body` (Roboto) — all loaded via `next/font/google` in `app/layout.tsx`.

### Environment variables

`NEXT_PUBLIC_API_BASE_URL` is the only required public variable. It is baked into the Docker image at build time, so staging and production require separate builds.

### Deployment

GitLab CI pipeline: `test` → `build:staging` → `deploy:staging` (auto on `main`); `build:production` → `deploy:production` (manual). ESLint is suppressed during Next.js builds (`ignoreDuringBuilds: true` in `next.config.js`) — lint must pass in the `test` stage instead.

Sentry is configured for error tracking with 10% trace sampling. Source maps are uploaded via the Sentry webpack plugin using `SENTRY_AUTH_TOKEN`.
