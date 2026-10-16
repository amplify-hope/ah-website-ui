import { serve } from 'lib/deps'
import { handleCheckoutSession } from 'lib/handlers/checkout-sessions'
import { CheckoutSessionContext } from 'lib/types'

export const GET = serve<CheckoutSessionContext>(handleCheckoutSession)
