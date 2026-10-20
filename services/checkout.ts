import Stripe from 'stripe'
import { requestJson } from '../utils/api-client'

export const getCheckoutSession = (
  id: string
): Promise<Stripe.Checkout.Session> =>
  requestJson<Stripe.Checkout.Session>(`/api/checkout-sessions/${id}`)
