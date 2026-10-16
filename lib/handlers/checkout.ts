import Stripe from 'stripe'
import * as yup from 'yup'
import { jsonError } from '../api-response'
import {
  buildLookupKey,
  fundFromProductName,
  parseDonationBody,
  stripeRecurrence
} from '../donation'
import { Deps, JsonValue } from '../types'
import { appUrl } from '../url'
import { DonationRequestBody } from '../../common/types'
import { CURRENCY } from '../../config'
import { formatAmountForStripe } from '../../utils/stripe-helpers'

// POST /api/checkout
// Creates (or reuses) a Stripe price for the donation amount and starts a
// Checkout Session. The UI redirects to Stripe with the returned session id.
export const handleCheckout = async (
  req: Request,
  { stripe, env }: Deps
): Promise<Response> => {
  let body: JsonValue
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Request body must be valid JSON')
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonError(400, 'Request body must be a JSON object')
  }

  // Checked before anything else, as ah-website-api did.
  if (body.isRecurring === true && !body.interval) {
    return jsonError(403, 'A recurring donation requires an interval')
  }

  let donation: DonationRequestBody
  try {
    donation = parseDonationBody(body)
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      return jsonError(400, err.message)
    }
    throw err
  }

  const { amount, email, interval, stripeProductId, notes, isRecurring } =
    donation

  let product: Stripe.Product | Stripe.DeletedProduct
  try {
    product = await stripe.products.retrieve(stripeProductId)
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === 'resource_missing'
    ) {
      return jsonError(400, 'Invalid product')
    }
    throw err
  }
  if (product.deleted || !product.active) {
    return jsonError(400, 'Invalid product')
  }

  const cents = formatAmountForStripe(amount, CURRENCY)
  const lookupKey = buildLookupKey(stripeProductId, interval, cents)
  const { interval: stripeInterval, intervalCount } = stripeRecurrence(interval)

  const foundPrices = await stripe.prices.list({
    product: stripeProductId,
    lookup_keys: [lookupKey],
    ...(isRecurring && { recurring: { interval: stripeInterval } })
  })

  const price =
    foundPrices.data[0] ??
    (await stripe.prices.create({
      currency: CURRENCY,
      product: stripeProductId,
      unit_amount: cents,
      lookup_key: lookupKey,
      ...(isRecurring && {
        recurring: { interval: stripeInterval, interval_count: intervalCount }
      })
    }))

  const customers = await stripe.customers.list({ email })
  const existingCustomer = customers.data[0]

  const session = await stripe.checkout.sessions.create({
    ...(existingCustomer
      ? { customer: existingCustomer.id }
      : { customer_email: email }),
    mode: isRecurring ? 'subscription' : 'payment',
    line_items: [{ price: price.id, quantity: 1 }],
    billing_address_collection: 'required',
    metadata: { notes: notes ?? '', fund: fundFromProductName(product.name) },
    success_url: appUrl(env.CLIENT_BASE_URL, '/result/{CHECKOUT_SESSION_ID}'),
    cancel_url: appUrl(env.CLIENT_BASE_URL)
  })

  return Response.json(session)
}
