import { serve } from 'lib/deps'
import { handleVerify } from 'lib/handlers/verify'

export const GET = serve(handleVerify)
