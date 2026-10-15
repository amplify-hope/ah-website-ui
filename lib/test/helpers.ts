import { CreateEmailOptions, CreateEmailResponse, Resend } from 'resend'
import Stripe from 'stripe'
import { JsonValue, ServerEnv, StripeCall } from '../types'

export const testEnv: ServerEnv = {
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  JWT_SECRET: 'test-jwt-secret',
  RESEND_API_KEY: 're_fake',
  RESEND_TEMPLATE_ID: 'template-fake',
  CLIENT_BASE_URL: 'https://example.com'
}

type FakeMethod = (...args: never[]) => Promise<object>

// Builds a Stripe-shaped fake from dotted method paths, e.g.
// fakeStripe({ 'products.search': async () => ({ data: [] }) }).
// Calls are recorded, and any method that wasn't provided throws, so a handler
// can't silently reach for an API call the test didn't expect.
export const fakeStripe = (methods: Record<string, FakeMethod>) => {
  const calls: StripeCall[] = []
  const root: Record<string, object> = {}

  for (const [path, impl] of Object.entries(methods)) {
    const parts = path.split('.')
    const name = parts.pop() as string
    let node = root
    for (const part of parts) {
      node = (node[part] ??= {}) as Record<string, object>
    }
    node[name] = async (...args: never[]) => {
      calls.push({ method: path, args })
      return impl(...args)
    }
  }

  const stripe = new Proxy<object>(root, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        return new Proxy<object>(
          {},
          {
            get(_, method) {
              return () => {
                throw new Error(
                  `Unexpected Stripe call: ${prop}.${String(method)}`
                )
              }
            }
          }
        )
      }
      return Reflect.get(target, prop)
    }
  }) as Stripe

  return { stripe, calls }
}

type FakeSend = (params: CreateEmailOptions) => Promise<CreateEmailResponse>

// Resend fake that records the emails it was asked to send. Resend resolves
// with { data, error } instead of throwing on API errors, so the default send
// succeeds and tests return an error result to simulate a failure.
export const fakeResend = (
  send: FakeSend = async () => ({
    data: { id: 'email_1' },
    error: null,
    headers: null
  })
) => {
  const sent: CreateEmailOptions[] = []
  const emails = {
    send: async (params: CreateEmailOptions) => {
      sent.push(params)
      return send(params)
    }
  }

  return { resend: { emails } as Resend, sent }
}

// The first argument the named Stripe method was called with, typed by the
// caller, e.g. firstArg<Stripe.PriceCreateParams>(calls, 'prices.create').
export const firstArg = <T extends object = object>(
  calls: StripeCall[],
  method: string
): T => calls.find(call => call.method === method)?.args[0] as T

export const jsonRequest = (
  url: string,
  body: JsonValue | object,
  init: RequestInit = {}
): Request =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init
  })
