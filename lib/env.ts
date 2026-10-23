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

// How soon to try again after a refresh failed and the previous values were
// kept, so a blip at the TTL boundary neither fails requests nor waits out a
// whole TTL.
const REFRESH_RETRY_MS = 30 * 1000

type CacheEntry = { loadedAt: number; env: Promise<ServerEnv> }

let cached: CacheEntry | undefined
let lastGood: ServerEnv | undefined

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

  const previous = lastGood
  const env = loadRawEnv(fetchSecret)
    .then(parseServerEnv)
    .then(
      value => {
        lastGood = value
        return value
      },
      (err: unknown) => {
        if (!previous) throw err
        console.error(
          'Server env refresh failed, keeping the previous values:',
          err instanceof Error ? err.message : err
        )
        entry.loadedAt = Date.now() - CACHE_TTL_MS + REFRESH_RETRY_MS
        return previous
      }
    )
  const entry: CacheEntry = { loadedAt: Date.now(), env }
  cached = entry
  env.catch(() => {
    if (cached === entry) cached = undefined
  })
  return env
}

export const resetServerEnvCache = (): void => {
  cached = undefined
  lastGood = undefined
}
