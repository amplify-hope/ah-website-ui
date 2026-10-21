import Stripe from 'stripe'
import { getServerEnv } from '../lib/env'

let stripeClient: Stripe | undefined

// Shared server-side Stripe client. Created lazily so the secret key is only
// read at request time, and reused across requests in the same runtime.
export const getStripe = async (): Promise<Stripe> => {
  if (!stripeClient) {
    const { STRIPE_SECRET_KEY } = await getServerEnv()
    stripeClient = new Stripe(STRIPE_SECRET_KEY, { typescript: true })
  }
  return stripeClient
}
