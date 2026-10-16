import Stripe from 'stripe'
import { jsonError } from '../api-response'
import { verifyMagicLinkToken } from '../magic-link'
import { Deps, MagicLinkPayload } from '../types'
import { appUrl } from '../url'

const INVALID_LINK = 'This sign-in link is invalid or has expired'

// GET /api/verify?token=...
// Opened from the magic link email. A valid token redirects straight to a
// Stripe billing portal session; there is no app session or cookie.
export const handleVerify = async (
  req: Request,
  { stripe, env }: Deps
): Promise<Response> => {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return jsonError(401, INVALID_LINK)

  let payload: MagicLinkPayload
  try {
    payload = verifyMagicLinkToken(token, env.JWT_SECRET)
  } catch {
    return jsonError(401, INVALID_LINK)
  }

  let donor: Stripe.Customer | Stripe.DeletedCustomer
  try {
    donor = await stripe.customers.retrieve(payload.stripeCustomerId)
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === 'resource_missing'
    ) {
      return jsonError(401, INVALID_LINK)
    }
    throw err
  }
  if (donor.deleted) return jsonError(401, INVALID_LINK)

  const session = await stripe.billingPortal.sessions.create({
    customer: donor.id,
    return_url: appUrl(env.CLIENT_BASE_URL)
  })

  return Response.redirect(session.url, 302)
}
