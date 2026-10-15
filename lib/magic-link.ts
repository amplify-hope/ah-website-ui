import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { MagicLinkPayload, ServerEnv } from './types'
import { appUrl } from './url'

const MAGIC_LINK_FROM = 'no-reply@amplifyhope.cc'
const MAGIC_LINK_TTL = '10m'

export const signMagicLinkToken = (
  payload: MagicLinkPayload,
  secret: string
): string =>
  jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: MAGIC_LINK_TTL })

// The link goes to this app's own /api/verify route, which redirects to the
// Stripe billing portal.
export const buildMagicLink = (env: ServerEnv, token: string): string =>
  appUrl(env.CLIENT_BASE_URL, `/api/verify?token=${encodeURIComponent(token)}`)

// Resend resolves with { data, error } instead of throwing on API errors, so
// callers must check `error`.
export const sendMagicLink = (
  resend: Resend,
  env: ServerEnv,
  email: string,
  stripeCustomerId: string,
  token: string
) =>
  resend.emails.send({
    from: MAGIC_LINK_FROM,
    to: email,
    template: {
      id: env.RESEND_TEMPLATE_ID,
      variables: { MAGIC_LINK: buildMagicLink(env, token) }
    },
    tags: [
      {
        name: 'environment',
        value:
          process.env.NEXT_PUBLIC_APP_ENV ??
          process.env.NODE_ENV ??
          'development'
      },
      { name: 'stripe_customer_id', value: stripeCustomerId }
    ]
  })
