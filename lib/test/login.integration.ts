import { expect } from 'chai'
import jwt from 'jsonwebtoken'
import { withErrorHandling } from '../api-response'
import { handleLogin } from '../handlers/login'
import { JsonValue } from '../types'
import { fakeResend, fakeStripe, jsonRequest, testEnv } from './helpers'

const email = 'donor@example.com'

const callLogin = (
  body: JsonValue | object,
  {
    customers = [{ id: 'cus_1' }],
    send,
    request
  }: {
    customers?: { id: string }[]
    send?: Parameters<typeof fakeResend>[0]
    request?: Request
  } = {}
) => {
  const { stripe, calls } = fakeStripe({
    'customers.list': async () => ({ data: customers })
  })
  const { resend, sent } = fakeResend(send)
  const response = handleLogin(
    request ?? jsonRequest('http://localhost/api/login', body),
    { stripe, env: testEnv, resend }
  )
  return { response, calls, sent }
}

describe('#POST /api/login', () => {
  const originalConsoleError = console.error
  let logged: Parameters<typeof console.error>[] = []

  beforeEach(() => {
    logged = []
    console.error = (...args: Parameters<typeof console.error>) => {
      logged.push(args)
    }
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  describe('known donor', () => {
    it('should email a signed magic link and return 204', async () => {
      const { response, calls, sent } = callLogin({ email })
      const result = await response

      expect(result.status).to.eq(204)
      expect(await result.text()).to.eq('')
      expect(calls).to.deep.eq([
        { method: 'customers.list', args: [{ email }] }
      ])
      expect(sent).to.have.length(1)

      const message = sent[0]
      expect(message.to).to.eq(email)
      expect(message.from).to.eq('no-reply@amplifyhope.cc')
      expect(message.template?.id).to.eq('template-fake')
      expect(message.tags).to.deep.include({
        name: 'stripe_customer_id',
        value: 'cus_1'
      })

      const link = new URL(String(message.template?.variables?.MAGIC_LINK))
      expect(link.origin + link.pathname).to.eq(
        'https://example.com/api/verify'
      )
      const claims = jwt.verify(
        link.searchParams.get('token') as string,
        testEnv.JWT_SECRET,
        { algorithms: ['HS256'] }
      ) as jwt.JwtPayload
      expect(claims.stripeCustomerId).to.eq('cus_1')
      expect(claims.email).to.eq(email)
    })

    it('should use the first customer when Stripe has several for the email', async () => {
      const { response, sent } = callLogin(
        { email },
        { customers: [{ id: 'cus_first' }, { id: 'cus_second' }] }
      )
      await response

      expect(sent[0].tags).to.deep.include({
        name: 'stripe_customer_id',
        value: 'cus_first'
      })
    })
  })

  describe('unknown donor', () => {
    it('should return 404 and send no email', async () => {
      const { response, sent } = callLogin({ email }, { customers: [] })
      const result = await response

      expect(result.status).to.eq(404)
      expect(await result.json()).to.deep.eq({
        errors: ['No account found for that email']
      })
      expect(sent).to.have.length(0)
    })
  })

  describe('validation', () => {
    for (const body of [
      {},
      { email: '' },
      { email: 'not-an-email' },
      { email: 42 }
    ]) {
      it(`should reject ${JSON.stringify(body)} with a 400 and touch neither Stripe nor Resend`, async () => {
        const { response, calls, sent } = callLogin(body)

        expect((await response).status).to.eq(400)
        expect(calls).to.have.length(0)
        expect(sent).to.have.length(0)
      })
    }

    for (const body of [null, [], 'text', 42]) {
      it(`should reject a ${JSON.stringify(body)} body with a 400`, async () => {
        const { response, calls } = callLogin(body)
        const result = await response

        expect(result.status).to.eq(400)
        expect(await result.json()).to.deep.eq({
          errors: ['Request body must be a JSON object']
        })
        expect(calls).to.have.length(0)
      })
    }

    it('should reject a body that is not valid JSON', async () => {
      const { response, calls } = callLogin(null, {
        request: new Request('http://localhost/api/login', {
          method: 'POST',
          body: '{not json'
        })
      })

      expect((await response).status).to.eq(400)
      expect(calls).to.have.length(0)
    })
  })

  describe('failures', () => {
    it('should return a generic 500 and log when Resend reports an error', async () => {
      const { response } = callLogin(
        { email },
        {
          send: async () => ({
            data: null,
            error: {
              name: 'application_error',
              message: 'resend secret detail',
              statusCode: 500
            },
            headers: null
          })
        }
      )
      const result = await response

      expect(result.status).to.eq(500)
      expect(await result.json()).to.deep.eq({
        errors: ['Unable to send the sign-in link']
      })
      expect(JSON.stringify(logged)).to.contain('resend secret detail')
    })

    it('should surface a Resend exception as a 500 through the route wrapper', async () => {
      const { stripe } = fakeStripe({
        'customers.list': async () => ({ data: [{ id: 'cus_1' }] })
      })
      const { resend } = fakeResend(async () => {
        throw new Error('network down')
      })

      const result = await withErrorHandling(() =>
        handleLogin(jsonRequest('http://localhost/api/login', { email }), {
          stripe,
          env: testEnv,
          resend
        })
      )

      expect(result.status).to.eq(500)
    })

    it('should surface a Stripe failure as a 500 and send no email', async () => {
      const { stripe } = fakeStripe({
        'customers.list': async () => {
          throw new Error('Stripe is down')
        }
      })
      const { resend, sent } = fakeResend()

      const result = await withErrorHandling(() =>
        handleLogin(jsonRequest('http://localhost/api/login', { email }), {
          stripe,
          env: testEnv,
          resend
        })
      )

      expect(result.status).to.eq(500)
      expect(sent).to.have.length(0)
    })
  })
})
