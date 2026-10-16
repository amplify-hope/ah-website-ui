# Amplify Hope Website Release Notes

## v2.8.0

- Consolidated the API into this app
  - Checkout, products, checkout sessions, sign in and email verification now run as Next.js route handlers under `/api`
  - The site no longer calls the separate API project
  - Removed the Stripe webhook and the unauthenticated portal session route
  - Invalid checkout requests return a 400 instead of a 500
  - Checkout redirect URLs come from `CLIENT_BASE_URL` instead of the request origin
  - The result page shows the fund that was donated to
- Upgraded Stripe SDK to version 23
- Added route handler tests (`yarn test:integration`) and run them in the pipeline
- Deploys read server settings from `~/.env/.ah-ui.env` on the host
- Added option to cover Stripe fees on the donation form
- Donation funds are loaded from Stripe instead of being hardcoded
- Added Who We Are page
- Updated address and made the copyright year dynamic
- Fixed favicon and result page build
- Updated Sentry integration and reduced trace sampling
- Upgraded Node.JS to version 24
- Upgraded dependencies and pinned versions to resolve security vulnerabilities
- Added container restart policy and image cleanup to deploys
- Added CLAUDE.md and expanded the README

## v2.7.1

- Upgraded dependencies

## v2.7.0

- Upgraded Node.JS to version 20
- Added link to manage giving
- Added sign in page
- Added verify email page

## v2.6.0

- Added notes field to donation form

## v2.5.0

- Upgraded Node.JS to version 18

## v2.4.0

- Removed Hope40

## v2.3.0

- Upgraded to Next.JS 13
- Removed Prisma

## v2.2.0

- Wrote unit tests for `stripe-helpers`
- Updated pipeline to run tests
- Moved API into it's own project
- Containerized application

## v2.1.0

- Fixed mobile nav
  - Was technically covered by dropdown menu on ios browsers.
- Added dev pipeline

## v2.0.0

- Complete redesign
  - Updated styles and layout
  - Added separate landing page

## v1.4.1

- Updated hope40 button

## v1.4.0

- Added hope40 page
- Added simple navigation
- Added reusable Button component

## v1.3.0

- Replaced react-md with tailwind css.
- Added fund field to donate form.
- Added samsons to website.
- Implemented responsive design.

## v1.2.0

- Added recurring payment option.
- Configured webhook endpoint.

## v1.1.0

- Added favicon.
- Updated Result-id page.

## v1.0.0

- Initial release.
- Includes basic checkout with checkout-session.
