import * as yup from 'yup'
import { jsonError } from '../api-response'
import { sendMagicLink, signMagicLinkToken } from '../magic-link'
import { EmailDeps, JsonValue } from '../types'
import { LoginWithEmailRequestBody } from '../../common/types'
import { LoginWithEmailSchema } from '../../utils/validation-schema'

// POST /api/login
// Emails a 10 minute sign-in link to a known donor. The link opens
// /api/verify, which redirects to the Stripe billing portal.
export const handleLogin = async (
  req: Request,
  { stripe, env, resend }: EmailDeps
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

  let login: LoginWithEmailRequestBody
  try {
    login = await LoginWithEmailSchema.validate(body)
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      return jsonError(400, err.message)
    }
    throw err
  }
  const { email } = login

  const customers = await stripe.customers.list({ email })
  const customer = customers.data[0]
  if (!customer) return jsonError(404, 'No account found for that email')

  const token = signMagicLinkToken(
    { stripeCustomerId: customer.id, email },
    env.JWT_SECRET
  )

  const { error } = await sendMagicLink(resend, env, email, customer.id, token)
  if (error) {
    console.error('There was an error sending the magic link:', error.message)
    return jsonError(500, 'Unable to send the sign-in link')
  }

  return new Response(null, { status: 204 })
}
