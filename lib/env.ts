import * as yup from 'yup'
import { fetchSecretJson } from './secrets'
import { RawEnv, SecretFetcher, ServerEnv } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const serverEnvSchema: yup.ObjectSchema<ServerEnv> = yup
  .object({
    STRIPE_SECRET_KEY: yup.string().required(),
    JWT_SECRET: yup.string().required(),
    RESEND_API_KEY: yup.string().required(),
    RESEND_TEMPLATE_ID: yup.string().required(),
    CLIENT_BASE_URL: yup
      .string()
      .test('http-url', '${path} must be an http(s) url', value =>
        isHttpUrl(value ?? '')
      )
      .required()
  })
  .required()

let cached: { loadedAt: number; env: Promise<ServerEnv> } | undefined

const loadRawEnv = async (fetchSecret: SecretFetcher): Promise<RawEnv> => {
  const { AH_SECRET_ID, AH_AWS_REGION } = process.env
  if (!AH_SECRET_ID) return process.env
  if (!AH_AWS_REGION) {
    throw new Error('AH_AWS_REGION is required when AH_SECRET_ID is set')
  }
  return fetchSecret(AH_SECRET_ID, AH_AWS_REGION)
}

const parseServerEnv = (raw: RawEnv): ServerEnv => {
  try {
    return serverEnvSchema.validateSync(raw, {
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
}

export const getServerEnv = (
  fetchSecret: SecretFetcher = fetchSecretJson
): Promise<ServerEnv> => {
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.env

  const env = loadRawEnv(fetchSecret).then(parseServerEnv)
  const entry = { loadedAt: Date.now(), env }
  cached = entry
  env.catch(() => {
    if (cached === entry) cached = undefined
  })
  return env
}

export const resetServerEnvCache = (): void => {
  cached = undefined
}
