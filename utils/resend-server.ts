import { Resend } from 'resend'
import { getServerEnv } from '../lib/env'

let resendClient: Resend | undefined

// Shared server-side Resend client, created lazily so the API key is only read
// at request time.
export const getResend = (): Resend => {
  if (!resendClient) {
    resendClient = new Resend(getServerEnv().RESEND_API_KEY)
  }
  return resendClient
}
