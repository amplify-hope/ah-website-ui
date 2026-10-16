import Stripe from 'stripe'
import fetchJson from '../utils/fetchJson'

export const getCheckoutSession = async (
  id: string
): Promise<Stripe.Checkout.Session> => {
  const foundSession = await fetchJson(`/api/checkout-sessions/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  return foundSession
}
