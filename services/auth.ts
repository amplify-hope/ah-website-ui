import { LoginWithEmailRequestBody } from '../common/types'
import { ApiError, requestJson } from '../utils/api-client'

// Asks for a sign-in link. An unknown email (404) resolves like a sent link so
// the sign-in page does not reveal which emails belong to donors; every other
// failure throws.
export const requestMagicLink = async (email: string): Promise<void> => {
  const body: LoginWithEmailRequestBody = { email }

  try {
    await requestJson('/api/login', { method: 'POST', body })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return
    throw err
  }
}
