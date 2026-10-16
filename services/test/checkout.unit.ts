import { expect } from 'chai'
import { getCheckoutSession } from '../checkout'

type FetchCall = { url: string; init?: RequestInit }

describe('#checkout service', () => {
  const originalFetch = globalThis.fetch
  let calls: FetchCall[] = []

  const stubFetch = (response: Response) => {
    calls = []
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init })
      return response
    }
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('getCheckoutSession', () => {
    const session = {
      id: 'cs_test_1',
      amount_total: 2500,
      mode: 'payment',
      metadata: { fund: 'General Fund' }
    }

    it('should fetch the session from the same-origin checkout-sessions route', async () => {
      stubFetch(Response.json(session))

      const result = await getCheckoutSession('cs_test_1')

      expect(result).to.deep.eq(session)
      expect(calls).to.have.length(1)
      expect(calls[0].url).to.eq('/api/checkout-sessions/cs_test_1')
      expect(calls[0].init?.method).to.eq('GET')
    })

    it('should resolve to false when the route rejects the id', async () => {
      stubFetch(
        Response.json(
          { errors: ['Invalid checkout session id'] },
          { status: 400 }
        )
      )

      expect(await getCheckoutSession('prod_123')).to.eq(false)
    })

    it('should resolve to false when the route fails', async () => {
      stubFetch(
        Response.json({ errors: ['Internal server error'] }, { status: 500 })
      )

      expect(await getCheckoutSession('cs_test_1')).to.eq(false)
    })
  })
})
