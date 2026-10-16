# Testing the Stripe integration

How the donation routes (`app/api/*`) are tested, and how to run a real end-to-end pass against a Stripe sandbox. Based on Stripe's testing docs: [Test your integration](https://docs.stripe.com/testing), [Automated testing](https://docs.stripe.com/automated-testing), and [Test your Billing integration](https://docs.stripe.com/billing/testing).

## Automated tests (CI)

```bash
yarn test:unit          # pure helpers: lib/*.ts, utils/*.ts
yarn test:integration   # each Route Handler, called with a real Request
```

Stripe's guidance for CI is to mock Stripe responses and keep real API calls to occasional validation, because the API is rate limited. The route tests follow that and never touch the network.

Each route's logic lives in `lib/handlers/<name>.ts` as `handleX(req, deps, ctx)`. The `route.ts` file is a one-line adapter (`serve(handleX)`), so tests call the handler directly with fake dependencies from `lib/test/helpers.ts`:

| Helper                             | Use                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `fakeStripe({ 'prices.list': … })` | Stripe-shaped fake built from dotted method paths. Records every call, and throws on any method the test didn't provide.                       |
| `fakeResend(send?)`                | Resend fake that records sent emails. Resend resolves `{ data, error }` rather than throwing, so return an error result to simulate a failure. |
| `firstArg<T>(calls, method)`       | The first argument a faked method was called with, typed by the caller, e.g. `firstArg<Stripe.PriceCreateParams>(calls, 'prices.create')`.     |
| `jsonRequest(url, body)`           | Builds a JSON `POST` request.                                                                                                                  |
| `testEnv`                          | A valid `ServerEnv` with fake values.                                                                                                          |

```ts
const { stripe, calls } = fakeStripe({
  'products.search': async () => ({ data: [] })
})
const response = await handleProducts(
  new Request('http://localhost/api/products/one-time'),
  { stripe, env: testEnv },
  { params: Promise.resolve({ type: 'one-time' }) }
)
```

Unexpected errors go through `withErrorHandling` (what `serve` uses), so tests that expect a 500 wrap the handler in it.

The fixtures are hand-built from Stripe's API reference. If a Stripe response shape changes, update them from a real sandbox object.

## Sandbox end-to-end (manual, not CI)

Run this before a release, and after changing checkout, login or verify. Stripe recommends **general sandboxes** (not the test mode sandbox) for new integrations, with separate sandboxes for local development and CI so tests don't disturb each other's data.

### Setup

1. Create a general sandbox for local development in the [Stripe Dashboard](https://dashboard.stripe.com/sandboxes) and copy its test keys.
2. Put these in `.env.local`:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` (sandbox keys)
   - `JWT_SECRET` (any string for local use)
   - `RESEND_API_KEY`, `RESEND_TEMPLATE_ID` (the magic-link email is sent through Resend with this key, so use an address you control)
   - `CLIENT_BASE_URL=http://localhost:3000` (any http or https origin works, `localhost` included)
3. Create products with `metadata.type` set to `one-time` or `recurring`. Names look like `General Fund|one-time`; the part before the pipe is the fund shown on the form and on the result page.
4. `yarn dev`

> Stripe Search is eventually consistent. A product you just created can take a moment to appear in `/api/products/[type]`.

### Scenarios

Use a different test card for each independent scenario, since card-level state persists between tests. Use any future expiry and any CVC.

| Scenario                     | How                                                                                 | Expect                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| One-time donation            | Donate with `4242 4242 4242 4242`                                                   | Result page shows the amount and fund; payment succeeded in the Dashboard    |
| Declined card                | `4000 0000 0000 0002` (generic decline), `4000 0000 0000 9995` (insufficient funds) | Stripe Checkout shows the decline; no payment                                |
| 3D Secure                    | `4000 0027 6000 3184`                                                               | 3DS challenge appears; completing it succeeds                                |
| Monthly, quarterly, yearly   | Donate recurring with each interval                                                 | Subscription created; quarterly shows as every 3 months                      |
| New donor                    | Donate one-time with an email Stripe has not seen                                   | A customer is created for the email, so the QuickBooks sync sees a new donor |
| Returning donor              | Start a second donation with the same email (no need to pay)                        | The session carries `customer` instead of `customer_email`                   |
| Price reuse                  | Repeat an identical amount                                                          | The existing price (lookup key) is reused, not duplicated                    |
| Magic-link login             | Use a donor's email on `/auth/signin`, open the emailed link                        | Redirects to the Stripe billing portal; the link expires after 10 minutes    |
| Unknown email / expired link | Sign in with an unknown email; open a link after 10 minutes, or edit the token      | 404 on login; 401 on verify                                                  |
| Simulated location           | Use an email like `test+location_US@example.com`                                    | Checkout behaves as if the donor were in that country                        |

### Recurring renewals (no webhook)

There is no Stripe webhook endpoint. Stripe finalizes draft subscription invoices on its own, about an hour after they are created, and then collects payment. To check a renewal without waiting, use a [test clock](https://docs.stripe.com/billing/testing/test-clocks):

1. Create a test clock in the sandbox, and a customer attached to it.
2. Create a subscription for that customer (in the Dashboard or through the API).
3. Advance the clock past the next billing date, then past the finalization delay.
4. Confirm the renewal invoice went from `draft` to `open` to `paid` without any action from the app.

## Rate limits

Test environments have stricter rate limits than live mode and return `429` when exceeded. Don't load test a sandbox, and keep real API calls out of CI.
