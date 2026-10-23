import { expect } from 'chai'
import { fetchSecretJson } from '../secrets'
import { SecretsClient } from '../types'

const clientReturning = (SecretString?: string): SecretsClient => ({
  send: async () => ({ SecretString, $metadata: {} })
})

const rejection = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise
  } catch (err) {
    return (err as Error).message
  }
  return ''
}

describe('#secrets', () => {
  describe('fetchSecretJson', () => {
    it('should return the parsed JSON secret', async () => {
      const client = clientReturning('{"JWT_SECRET":"abc"}')

      expect(await fetchSecretJson('id', 'us-west-2', client)).to.deep.eq({
        JWT_SECRET: 'abc'
      })
    })

    it('should ask for the secret by id and pass a deadline', async () => {
      const seen: { id?: string; signal?: AbortSignal } = {}
      const client: SecretsClient = {
        send: async (command, options) => {
          seen.id = command.input.SecretId
          seen.signal = options?.abortSignal
          return { SecretString: '{}', $metadata: {} }
        }
      }

      await fetchSecretJson('ah-website/staging', 'us-west-2', client)

      expect(seen.id).to.eq('ah-website/staging')
      expect(seen.signal).to.be.instanceOf(AbortSignal)
      expect(seen.signal?.aborted).to.eq(false)
    })

    it('should give up on a call that never answers', async () => {
      const hung: SecretsClient = {
        send: (_command, options) =>
          new Promise((_resolve, reject) => {
            options?.abortSignal?.addEventListener('abort', () =>
              reject(new Error('aborted'))
            )
          })
      }

      const message = await rejection(
        fetchSecretJson('id', 'us-west-2', hung, 20)
      )

      expect(message).to.eq('aborted')
    })

    it('should reject a secret with no string value', async () => {
      const message = await rejection(
        fetchSecretJson('id', 'us-west-2', clientReturning(undefined))
      )

      expect(message).to.contain('has no string value')
    })
  })
})
