import { serve } from 'lib/deps'
import { handleCheckout } from 'lib/handlers/checkout'

export const POST = serve(handleCheckout)
