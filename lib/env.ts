import * as yup from 'yup'
import { ServerEnv } from './types'

const serverEnvSchema: yup.ObjectSchema<ServerEnv> = yup
  .object({
    STRIPE_SECRET_KEY: yup.string().required(),
    JWT_SECRET: yup.string().required(),
    RESEND_API_KEY: yup.string().required(),
    RESEND_TEMPLATE_ID: yup.string().required(),
    CLIENT_BASE_URL: yup.string().url().required()
  })
  .required()

let cachedEnv: ServerEnv | undefined

// Server-only secrets. Parsed lazily on first use (not at import time) so
// `next build` doesn't need them. Error messages name the offending variables
// but never include their values.
export const getServerEnv = (): ServerEnv => {
  if (cachedEnv) return cachedEnv

  try {
    cachedEnv = serverEnvSchema.validateSync(process.env, {
      abortEarly: false,
      stripUnknown: true
    })
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const invalidNames = [
        ...new Set(err.inner.map(issue => issue.path ?? 'unknown'))
      ]
      throw new Error(
        `Invalid or missing server environment variables: ${invalidNames.join(', ')}`
      )
    }
    throw err
  }

  return cachedEnv
}

export const resetServerEnvCache = (): void => {
  cachedEnv = undefined
}
