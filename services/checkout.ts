import Stripe from 'stripe'
import { DonationRequestBody } from '../common/types'
import { requestJson } from '../utils/api-client'

export const getCheckoutSession = (
  id: string
): Promise<Stripe.Checkout.Session> =>
  requestJson<Stripe.Checkout.Session>(`/api/checkout-sessions/${id}`)

export const createCheckoutSession = (
  body: DonationRequestBody
): Promise<Stripe.Checkout.Session> =>
  requestJson<Stripe.Checkout.Session>('/api/checkout', {
    method: 'POST',
    body
  })
