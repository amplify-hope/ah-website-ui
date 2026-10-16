import { Resend } from 'resend'
import Stripe from 'stripe'

export type ServerEnv = {
  STRIPE_SECRET_KEY: string
  JWT_SECRET: string
  RESEND_API_KEY: string
  RESEND_TEMPLATE_ID: string
  CLIENT_BASE_URL: string
}

export type Deps = {
  stripe: Stripe
  env: ServerEnv
}

// For handlers that also send email.
export type EmailDeps = Deps & {
  resend: Resend
}

export type MagicLinkPayload = {
  stripeCustomerId: string
  email: string
}

// Anything req.json() can produce.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

// What a Stripe API method is called with: an id or a params object.
export type StripeArg = string | object

export type StripeCall = { method: string; args: StripeArg[] }

// Context for routes with no dynamic segment. Next requires a route's second
// parameter to carry `params`, so the default can't be a bare `object`.
export type NoParamsContext = { params: Promise<Record<string, never>> }

export type ProductType = 'one-time' | 'recurring'

export type ProductsContext = { params: Promise<{ type: string }> }

export type CheckoutSessionContext = { params: Promise<{ id: string }> }
