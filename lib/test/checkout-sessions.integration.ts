import { expect } from 'chai'
import { withErrorHandling } from '../api-response'
import { handleCheckoutSession } from '../handlers/checkout-sessions'
import { fakeStripe, testEnv } from './helpers'

const session = {
  id: 'cs_test_123',
  object: 'checkout.session',
  amount_total: 2500,
  mode: 'subscription',
  metadata: { fund: 'General Fund', notes: ' ' },
  payment_intent: { id: 'pi_123', status: 'succeeded' }
}

const callSession = (id: string, methods = {}) => {
  const { stripe, calls } = fakeStripe({
    'checkout.sessions.retrieve': async () => session,
    ...methods
  })
  const response = handleCheckoutSession(
    new Request(`http://localhost/api/checkout-sessions/${id}`),
    { stripe, env: testEnv },
    { params: Promise.resolve({ id }) }
  )
  return { response, calls }
}

describe('#GET /api/checkout-sessions/[id]', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = () => undefined
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('should retrieve the session with the payment intent expanded and return it as-is', async () => {
    const { response, calls } = callSession('cs_test_123')
    const result = await response

    expect(result.status).to.eq(200)
    expect(await result.json()).to.deep.eq(session)
    expect(calls).to.deep.eq([
      {
        method: 'checkout.sessions.retrieve',
        args: ['cs_test_123', { expand: ['payment_intent'] }]
      }
    ])
  })

  for (const id of ['prod_123', 'pi_123', 'test_cs_123', '']) {
    it(`should reject id ${JSON.stringify(id)} with a 400 and never query Stripe`, async () => {
      const { response, calls } = callSession(id)
      const result = await response

      expect(result.status).to.eq(400)
      expect(await result.json()).to.deep.eq({
        errors: ['Invalid checkout session id']
      })
      expect(calls).to.have.length(0)
    })
  }

  it('should surface a Stripe failure as a 500 through the route wrapper', async () => {
    const { stripe } = fakeStripe({
      'checkout.sessions.retrieve': async () => {
        throw new Error('No such checkout.session')
      }
    })

    const result = await withErrorHandling(() =>
      handleCheckoutSession(
        new Request('http://localhost/api/checkout-sessions/cs_test_missing'),
        { stripe, env: testEnv },
        { params: Promise.resolve({ id: 'cs_test_missing' }) }
      )
    )

    expect(result.status).to.eq(500)
    expect(await result.json()).to.deep.eq({
      errors: ['Internal server error']
    })
  })
})
