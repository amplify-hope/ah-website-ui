import { expect } from 'chai'
import jwt from 'jsonwebtoken'
import Stripe from 'stripe'
import { withErrorHandling } from '../api-response'
import { handleVerify } from '../handlers/verify'
import { signMagicLinkToken } from '../magic-link'
import { fakeStripe, firstArg, testEnv } from './helpers'

const claims = { stripeCustomerId: 'cus_1', email: 'donor@example.com' }
const portalUrl = 'https://billing.stripe.com/p/session/test_123'

const defaultMethods = {
  'customers.retrieve': async () => ({ id: 'cus_1' }),
  'billingPortal.sessions.create': async () => ({ url: portalUrl })
}

const callVerify = (token: string | null, methods = {}) => {
  const { stripe, calls } = fakeStripe({ ...defaultMethods, ...methods })
  const url = new URL('http://localhost/api/verify')
  if (token !== null) url.searchParams.set('token', token)
  const response = handleVerify(new Request(url), { stripe, env: testEnv })
  return { response, calls }
}

describe('#GET /api/verify', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = () => undefined
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('should redirect a valid token to a Stripe billing portal session', async () => {
    const { response, calls } = callVerify(
      signMagicLinkToken(claims, testEnv.JWT_SECRET)
    )
    const result = await response

    expect(result.status).to.eq(302)
    expect(result.headers.get('location')).to.eq(portalUrl)
    expect(calls).to.deep.eq([
      { method: 'customers.retrieve', args: ['cus_1'] },
      {
        method: 'billingPortal.sessions.create',
        args: [{ customer: 'cus_1', return_url: 'https://example.com' }]
      }
    ])
  })

  it('should build the portal return url from CLIENT_BASE_URL without a double slash', async () => {
    const { stripe, calls } = fakeStripe(defaultMethods)
    await handleVerify(
      new Request(
        `http://localhost/api/verify?token=${signMagicLinkToken(claims, testEnv.JWT_SECRET)}`
      ),
      { stripe, env: { ...testEnv, CLIENT_BASE_URL: 'https://example.com/' } }
    )

    expect(
      firstArg<Stripe.BillingPortal.SessionCreateParams>(
        calls,
        'billingPortal.sessions.create'
      ).return_url
    ).to.eq('https://example.com')
  })

  describe('rejected tokens', () => {
    const secret = testEnv.JWT_SECRET
    const valid = signMagicLinkToken(claims, secret)

    const cases: [string, string | null][] = [
      ['a missing token', null],
      ['an empty token', ''],
      ['garbage', 'not-a-jwt'],
      ['an expired token', jwt.sign(claims, secret, { expiresIn: -10 })],
      ['a token signed with another secret', signMagicLinkToken(claims, 'x')],
      [
        'a tampered token',
        `${valid.slice(0, -2)}${valid.endsWith('aa') ? 'bb' : 'aa'}`
      ],
      ['an unsigned token', jwt.sign(claims, '', { algorithm: 'none' })],
      [
        'a token signed with another algorithm',
        jwt.sign(claims, secret, { algorithm: 'HS512' })
      ],
      ['a token without a customer id', jwt.sign({ email: 'a@b.co' }, secret)]
    ]

    for (const [name, token] of cases) {
      it(`should return 401 for ${name} and never touch Stripe`, async () => {
        const { response, calls } = callVerify(token)
        const result = await response

        expect(result.status).to.eq(401)
        expect(await result.json()).to.deep.eq({
          errors: ['This sign-in link is invalid or has expired']
        })
        expect(calls).to.have.length(0)
      })
    }
  })

  describe('customer lookup', () => {
    const token = signMagicLinkToken(claims, testEnv.JWT_SECRET)

    it('should return 401 for a deleted customer and create no portal session', async () => {
      const { response, calls } = callVerify(token, {
        'customers.retrieve': async () => ({ id: 'cus_1', deleted: true })
      })

      expect((await response).status).to.eq(401)
      expect(calls.map(call => call.method)).to.deep.eq(['customers.retrieve'])
    })

    it('should return 401 when Stripe has no such customer', async () => {
      const { response, calls } = callVerify(token, {
        'customers.retrieve': async () => {
          throw new Stripe.errors.StripeInvalidRequestError({
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: 'No such customer'
          })
        }
      })

      expect((await response).status).to.eq(401)
      expect(calls.map(call => call.method)).to.deep.eq(['customers.retrieve'])
    })

    it('should surface other Stripe failures as a 500 through the route wrapper', async () => {
      const { stripe } = fakeStripe({
        ...defaultMethods,
        'customers.retrieve': async () => {
          throw new Error('Stripe is down')
        }
      })

      const result = await withErrorHandling(() =>
        handleVerify(
          new Request(`http://localhost/api/verify?token=${token}`),
          { stripe, env: testEnv }
        )
      )

      expect(result.status).to.eq(500)
    })

    it('should surface a portal session failure as a 500 through the route wrapper', async () => {
      const { stripe } = fakeStripe({
        ...defaultMethods,
        'billingPortal.sessions.create': async () => {
          throw new Error('Portal not configured')
        }
      })

      const result = await withErrorHandling(() =>
        handleVerify(
          new Request(`http://localhost/api/verify?token=${token}`),
          { stripe, env: testEnv }
        )
      )

      expect(result.status).to.eq(500)
    })
  })
})
