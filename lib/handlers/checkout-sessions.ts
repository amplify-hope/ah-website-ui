import { jsonError } from '../api-response'
import { CheckoutSessionContext, Deps } from '../types'

// GET /api/checkout-sessions/[id]
// Returns the full Stripe Checkout Session; the result page reads
// amount_total, mode and metadata.fund from it.
export const handleCheckoutSession = async (
  _req: Request,
  { stripe }: Deps,
  { params }: CheckoutSessionContext
): Promise<Response> => {
  const { id } = await params

  if (!id.startsWith('cs_')) {
    return jsonError(400, 'Invalid checkout session id')
  }

  const session = await stripe.checkout.sessions.retrieve(id, {
    expand: ['payment_intent']
  })

  return Response.json(session)
}
