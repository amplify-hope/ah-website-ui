import { Resend } from 'resend'
import { getServerEnv } from '../lib/env'

let resendClient: Resend | undefined

// Shared server-side Resend client, created lazily so the API key is only read
// at request time.
export const getResend = async (): Promise<Resend> => {
  if (!resendClient) {
    const { RESEND_API_KEY } = await getServerEnv()
    resendClient = new Resend(RESEND_API_KEY)
  }
  return resendClient
}
