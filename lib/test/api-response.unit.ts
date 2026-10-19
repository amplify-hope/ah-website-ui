import { expect } from 'chai'
import * as Sentry from '@sentry/nextjs'
import { jsonError, withErrorHandling } from '../api-response'

type ConsoleArgs = Parameters<typeof console.error>

describe('#apiResponse', () => {
  describe('jsonError', () => {
    it('should return the errors shape fetchJson reads, with the given status', async () => {
      const response = jsonError(400, 'Invalid amount')

      expect(response.status).to.eq(400)
      expect(await response.json()).to.deep.eq({ errors: ['Invalid amount'] })
    })
  })

  describe('withErrorHandling', () => {
    const originalConsoleError = console.error
    let logged: ConsoleArgs[] = []

    beforeEach(() => {
      logged = []
      console.error = (...args: ConsoleArgs) => {
        logged.push(args)
      }
    })

    afterEach(() => {
      console.error = originalConsoleError
    })

    it('should pass through the response the handler returns', async () => {
      const response = await withErrorHandling(
        async () => new Response(null, { status: 204 })
      )

      expect(response.status).to.eq(204)
      expect(logged).to.have.length(0)
    })

    it('should report a thrown error to Sentry', async () => {
      const reported: Sentry.Event[] = []
      Sentry.init({
        dsn: 'https://key@example.com/1',
        beforeSend: event => {
          reported.push(event)
          return null
        }
      })

      await withErrorHandling(async () => {
        throw new Error('boom')
      })
      await Sentry.close()

      expect(reported).to.have.length(1)
      expect(reported[0].exception?.values?.[0].value).to.eq('boom')
    })

    it('should turn a thrown error into a logged 500 without leaking the message', async () => {
      const response = await withErrorHandling(async () => {
        throw new Error('secret stripe detail')
      })

      expect(response.status).to.eq(500)
      expect(await response.json()).to.deep.eq({
        errors: ['Internal server error']
      })
      expect(JSON.stringify(logged)).to.contain('secret stripe detail')
    })
  })
})
