import { expect } from 'chai'
import * as Sentry from '@sentry/nextjs'
import { jsonError, withErrorHandling } from '../api-response'

type ConsoleArgs = Parameters<typeof console.error>

const SEND_DELAY_MS = 25

describe('#apiResponse', () => {
  describe('jsonError', () => {
    it('should return the errors shape requestJson reads, with the given status', async () => {
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

    it('should log the stack of a thrown error', async () => {
      await withErrorHandling(async () => {
        throw new Error('boom')
      })

      expect(JSON.stringify(logged)).to.contain('api-response.unit')
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

    describe('with Sentry initialised', () => {
      let reported: Sentry.Event[] = []
      let sent: unknown[] = []
      let pending: Promise<unknown> = Promise.resolve()

      // One init for the group: a second init after Sentry.close() does not pick
      // up a new transport. The transport takes a moment to send, so a test only
      // sees the envelope if the response waited for the flush.
      before(() => {
        Sentry.init({
          dsn: 'https://key@example.com/1',
          beforeSend: event => {
            reported.push(event)
            return event
          },
          transport: () => ({
            send: envelope => {
              pending = new Promise(resolve =>
                setTimeout(resolve, SEND_DELAY_MS)
              ).then(() => {
                sent.push(envelope)
                return {}
              })
              return pending as Promise<Record<string, never>>
            },
            flush: async () => {
              await pending
              return true
            }
          })
        })
      })

      beforeEach(() => {
        reported = []
        sent = []
      })

      after(async () => {
        await Sentry.close()
      })

      it('should report a thrown error to Sentry', async () => {
        await withErrorHandling(async () => {
          throw new Error('boom')
        })

        expect(reported).to.have.length(1)
        expect(reported[0].exception?.values?.[0].value).to.eq('boom')
      })

      it('should finish sending the event before it returns the response', async () => {
        await withErrorHandling(async () => {
          throw new Error('boom')
        })

        expect(sent).to.have.length(1)
      })
    })
  })
})
