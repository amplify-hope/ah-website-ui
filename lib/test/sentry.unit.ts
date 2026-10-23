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

    it('should keep breadcrumbs but strip query strings from their urls and messages', () => {
      const event: Event = {
        breadcrumbs: [
          {
            category: 'navigation',
            data: {
              from: '/donate',
              to: '/auth/verify?email=donor%40example.com'
            }
          },
          {
            category: 'fetch',
            data: {
              url: '/api/verify?token=secret',
              method: 'GET',
              status_code: 200
            }
          },
          { category: 'console', message: 'opened /auth/verify?email=a%40b.c' }
        ]
      }

      const { breadcrumbs } = scrubEvent(event)

      expect(breadcrumbs).to.have.length(3)
      expect(breadcrumbs?.[0].category).to.eq('navigation')
      expect(breadcrumbs?.[0].data).to.deep.eq({
        from: '/donate',
        to: '/auth/verify'
      })
      expect(breadcrumbs?.[1].data).to.deep.eq({
        url: '/api/verify',
        method: 'GET',
        status_code: 200
      })
      expect(breadcrumbs?.[2].message).to.eq('opened /auth/verify')
    })

    it('should strip the donor email from the url of an outgoing Stripe request span', () => {
      const event: Event = {
        spans: [
          {
            span_id: 'a',
            trace_id: 'b',
            start_timestamp: 1,
            description:
              'GET https://api.stripe.com/v1/customers?email=donor%40example.com&limit=1',
            data: {
              'http.url':
                'https://api.stripe.com/v1/customers?email=donor%40example.com&limit=1',
              'url.full':
                'https://api.stripe.com/v1/customers?email=donor%40example.com&limit=1',
              'url.query': '?email=donor%40example.com&limit=1',
              'http.query': 'email=donor%40example.com',
              'http.response.status_code': 200
            }
          }
        ]
      }

      const [span] = scrubEvent(event).spans ?? []

      expect(span.description).to.eq('GET https://api.stripe.com/v1/customers')
      expect(span.data).to.deep.eq({
        'http.url': 'https://api.stripe.com/v1/customers',
        'url.full': 'https://api.stripe.com/v1/customers',
        'http.response.status_code': 200
      })
      expect(JSON.stringify(event)).to.not.contain('donor')
    })

    it('should strip the magic-link token from the trace context', () => {
      const event: Event = {
        contexts: {
          trace: {
            span_id: 'a',
            trace_id: 'b',
            description: 'GET /api/verify?token=secret',
            data: {
              'url.full': 'https://amplifyhope.cc/api/verify?token=secret',
              'url.query': '?token=secret',
              'http.route': '/api/verify'
            }
          }
        }
      }

      const trace = scrubEvent(event).contexts?.trace

      expect(trace?.description).to.eq('GET /api/verify')
      expect(trace?.data).to.deep.eq({
        'url.full': 'https://amplifyhope.cc/api/verify',
        'http.route': '/api/verify'
      })
      expect(JSON.stringify(event)).to.not.contain('secret')
    })

    it('should leave span data that has no query string unchanged', () => {
      const event: Event = {
        spans: [
          {
            span_id: 'a',
            trace_id: 'b',
            start_timestamp: 1,
            description: 'GET /api/products/one-time',
            data: { 'http.method': 'GET', retries: 0, cached: false }
          }
        ]
      }

      const [span] = scrubEvent(event).spans ?? []

      expect(span.description).to.eq('GET /api/products/one-time')
      expect(span.data).to.deep.eq({
        'http.method': 'GET',
        retries: 0,
        cached: false
      })
    })

    it('should pass through an event without a request', () => {
      const event: Event = { message: 'hello' }

      expect(scrubEvent(event)).to.deep.eq({ message: 'hello' })
    })
  })
})
