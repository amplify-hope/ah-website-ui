import type {
  GetSecretValueCommand,
  GetSecretValueCommandOutput
} from '@aws-sdk/client-secrets-manager'
import type * as Sentry from '@sentry/nextjs'
import type { Resend } from 'resend'
import type Stripe from 'stripe'

export type ServerEnv = {
  STRIPE_SECRET_KEY: string
  JWT_SECRET: string
  RESEND_API_KEY: string
  RESEND_TEMPLATE_ID: string
  CLIENT_BASE_URL: string
}

export type RawEnv = Record<string, string | undefined>

export type SecretFetcher = (
  secretId: string,
  region: string
) => Promise<RawEnv>

// The part of the Secrets Manager client that fetchSecretJson uses, so a test
// can pass a fake.
export type SecretsClient = {
  send: (
    command: GetSecretValueCommand,
    options?: { abortSignal?: AbortSignal }
  ) => Promise<GetSecretValueCommandOutput>
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
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// What a Stripe API method is called with: an id or a params object.
export type StripeArg = string | object

export type StripeCall = { method: string; args: StripeArg[] }

// Context for routes with no dynamic segment. Next requires a route's second
// parameter to carry `params`, so the default can't be a bare `object`.
export type NoParamsContext = { params: Promise<Record<string, never>> }

export type ProductType = 'one-time' | 'recurring'

// What GET /api/products/[type] returns.
export type Product = {
  stripeId: string
  productName: string
  productType: ProductType
}

export type ProductsResponse = {
  products: Product[]
}

export type ProductsContext = { params: Promise<{ type: string }> }

export type CheckoutSessionContext = { params: Promise<{ id: string }> }

export type SentryOptions = NonNullable<Parameters<typeof Sentry.init>[0]>

export type RequestJsonOptions = {
  method?: 'GET' | 'POST'
  body?: JsonValue
}
