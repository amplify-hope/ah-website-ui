import {
  GetSecretValueCommand,
  SecretsManagerClient
} from '@aws-sdk/client-secrets-manager'
import { RawEnv, SecretsClient } from './types'

const CONNECTION_TIMEOUT_MS = 2000
const SOCKET_TIMEOUT_MS = 3000
const MAX_ATTEMPTS = 3
// Caps the whole call, retries included. Without it a hung connection never
// settles, and lib/env.ts would hand every request the same stalled promise.
const TOTAL_TIMEOUT_MS = 5000

const clients = new Map<string, SecretsManagerClient>()

const clientFor = (region: string): SecretsManagerClient => {
  let client = clients.get(region)
  if (!client) {
    client = new SecretsManagerClient({
      region,
      maxAttempts: MAX_ATTEMPTS,
      requestHandler: {
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        requestTimeout: SOCKET_TIMEOUT_MS
      }
    })
    clients.set(region, client)
  }
  return client
}

export const fetchSecretJson = async (
  secretId: string,
  region: string,
  client: SecretsClient = clientFor(region),
  timeoutMs: number = TOTAL_TIMEOUT_MS
): Promise<RawEnv> => {
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
    { abortSignal: AbortSignal.timeout(timeoutMs) }
  )
  if (!SecretString) {
    throw new Error(`Secret ${secretId} has no string value`)
  }
  return JSON.parse(SecretString)
}
