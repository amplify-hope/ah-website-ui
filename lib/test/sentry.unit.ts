import { expect } from 'chai'
import type { Event } from '@sentry/nextjs'
import { scrubEvent } from '../sentry'

describe('#sentry', () => {
  describe('scrubEvent', () => {
    it('should drop the body, cookies, query string and user', () => {
      const event: Event = {
        user: { email: 'donor@example.com' },
        request: {
          url: 'https://amplifyhope.cc/api/verify?token=secret',
          data: { email: 'donor@example.com' },
          cookies: { session: 'abc' },
          query_string: 'token=secret'
        }
      }

      const scrubbed = scrubEvent(event)

      expect(scrubbed.user).to.eq(undefined)
      expect(scrubbed.request?.data).to.eq(undefined)
      expect(scrubbed.request?.cookies).to.eq(undefined)
      expect(scrubbed.request?.query_string).to.eq(undefined)
      expect(scrubbed.request?.url).to.eq('https://amplifyhope.cc/api/verify')
    })

    it('should remove sensitive headers and keep the rest', () => {
      const event: Event = {
        request: {
          headers: {
            Cookie: 'a=b',
            Authorization: 'Bearer x',
            'X-Forwarded-For': '1.2.3.4',
            'user-agent': 'mocha'
          }
        }
      }

      expect(scrubEvent(event).request?.headers).to.deep.eq({
        'user-agent': 'mocha'
      })
    })

    it('should drop a url that cannot be parsed', () => {
      const event: Event = { request: { url: 'not a url' } }

      expect(scrubEvent(event).request?.url).to.eq(undefined)
    })

    it('should pass through an event without a request', () => {
      const event: Event = { message: 'hello' }

      expect(scrubEvent(event)).to.deep.eq({ message: 'hello' })
    })
  })
})
