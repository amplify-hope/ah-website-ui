import { jsonError } from 'lib/api-response'
import { serve } from 'lib/deps'

// TEMPORARY (WEB-30 J1/J5): proves a real error event reaches Sentry from the
// deployed build with the release set and no donor data in it. Staging only;
// remove after one event has been checked.
export const GET = serve(async (_req, { stripe }) => {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'staging') {
    return jsonError(404, 'Not found')
  }
  // Looking up a donor sends the email to Stripe as a query string, which is
  // what the scrubber has to remove from breadcrumbs and spans.
  await stripe.customers.list({ email: 'sentry-probe@example.com' })
  throw new Error('Sentry probe: expected, safe to ignore')
})
