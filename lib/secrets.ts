import {
  GetSecretValueCommand,
  SecretsManagerClient
} from '@aws-sdk/client-secrets-manager'
import { RawEnv } from './types'

export const fetchSecretJson = async (
  secretId: string,
  region: string
): Promise<RawEnv> => {
  const client = new SecretsManagerClient({ region })
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  )
  if (!SecretString) {
    throw new Error(`Secret ${secretId} has no string value`)
  }
  return JSON.parse(SecretString)
}
