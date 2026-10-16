import { expect } from 'chai'
import Stripe from 'stripe'
import { withErrorHandling } from '../api-response'
import { handleCheckout } from '../handlers/checkout'
import { JsonValue } from '../types'
import { fakeStripe, firstArg, jsonRequest, testEnv } from './helpers'

const product = {
  id: 'prod_general',
  name: 'General Fund|one-time',
  active: true
}
const session = { id: 'cs_test_1', object: 'checkout.session' }

const validBody = {
  email: 'donor@example.com',
  amount: 25,
  interval: null,
  stripeProductId: 'prod_general',
  notes: ' ',
  isRecurring: false
}

const defaultMethods = {
  'products.retrieve': async () => product,
  'prices.list': async () => ({ data: [] }),
  'prices.create': async () => ({ id: 'price_new' }),
  'customers.list': async () => ({ data: [] }),
  'checkout.sessions.create': async () => session
}

const callCheckout = (
  body: JsonValue | object,
  methods = {},
  env = testEnv,
  request?: Request
) => {
  const { stripe, calls } = fakeStripe({ ...defaultMethods, ...methods })
  const response = handleCheckout(
    request ?? jsonRequest('http://localhost/api/checkout', body),
    { stripe, env }
  )
  return { response, calls }
}

describe('#POST /api/checkout', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = () => undefined
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  describe('one-time donation', () => {
    it('should create a price, a session for a new customer, and return the session', async () => {
      const { response, calls } = callCheckout(validBody)
      const result = await response

      expect(result.status).to.eq(200)
      expect(await result.json()).to.deep.eq(session)
      expect(calls.map(call => call.method)).to.deep.eq([
        'products.retrieve',
        'prices.list',
        'prices.create',
        'customers.list',
        'checkout.sessions.create'
      ])
      expect(firstArg(calls, 'prices.list')).to.deep.eq({
        product: 'prod_general',
        lookup_keys: ['prod_general|2500']
      })
      expect(firstArg(calls, 'prices.create')).to.deep.eq({
        currency: 'usd',
        product: 'prod_general',
        unit_amount: 2500,
        lookup_key: 'prod_general|2500'
      })
      expect(firstArg(calls, 'checkout.sessions.create')).to.deep.eq({
        customer_email: 'donor@example.com',
        mode: 'payment',
        line_items: [{ price: 'price_new', quantity: 1 }],
        billing_address_collection: 'required',
        metadata: { notes: ' ', fund: 'General Fund' },
        success_url: 'https://example.com/result/{CHECKOUT_SESSION_ID}',
        cancel_url: 'https://example.com'
      })
    })

    it('should reuse an existing price instead of creating one', async () => {
      const { response, calls } = callCheckout(validBody, {
        'prices.list': async () => ({ data: [{ id: 'price_existing' }] })
      })
      await response

      expect(calls.map(call => call.method)).to.not.include('prices.create')
      expect(
        firstArg<Stripe.Checkout.SessionCreateParams>(
          calls,
          'checkout.sessions.create'
        ).line_items
      ).to.deep.eq([{ price: 'price_existing', quantity: 1 }])
    })

    it('should attach an existing Stripe customer instead of passing the email', async () => {
      const { response, calls } = callCheckout(validBody, {
        'customers.list': async () => ({ data: [{ id: 'cus_1' }] })
      })
      await response

      const params = firstArg<Stripe.Checkout.SessionCreateParams>(
        calls,
        'checkout.sessions.create'
      )
      expect(params.customer).to.eq('cus_1')
      expect(params).to.not.have.property('customer_email')
    })

    it('should round the amount to cents', async () => {
      const { response, calls } = callCheckout({ ...validBody, amount: 25.37 })
      await response

      expect(firstArg(calls, 'prices.create')).to.include({ unit_amount: 2537 })
    })

    it('should default missing notes to an empty string', async () => {
      const bodyWithoutNotes: Partial<typeof validBody> = { ...validBody }
      delete bodyWithoutNotes.notes
      const { response, calls } = callCheckout(bodyWithoutNotes)
      await response

      expect(
        firstArg<Stripe.Checkout.SessionCreateParams>(
          calls,
          'checkout.sessions.create'
        ).metadata?.notes
      ).to.eq('')
    })

    it('should not double the slash when CLIENT_BASE_URL has a trailing slash', async () => {
      const { response, calls } = callCheckout(
        validBody,
        {},
        {
          ...testEnv,
          CLIENT_BASE_URL: 'https://example.com/'
        }
      )
      await response

      expect(firstArg(calls, 'checkout.sessions.create')).to.include({
        success_url: 'https://example.com/result/{CHECKOUT_SESSION_ID}',
        cancel_url: 'https://example.com'
      })
    })
  })

  describe('recurring donation', () => {
    const recurring = (interval: string) => ({
      ...validBody,
      isRecurring: true,
      interval
    })

    it('should create a monthly subscription price and session', async () => {
      const { response, calls } = callCheckout(recurring('month'))
      await response

      expect(firstArg(calls, 'prices.list')).to.deep.eq({
        product: 'prod_general',
        lookup_keys: ['prod_general|month|2500'],
        recurring: { interval: 'month' }
      })
      expect(firstArg(calls, 'prices.create')).to.deep.eq({
        currency: 'usd',
        product: 'prod_general',
        unit_amount: 2500,
        lookup_key: 'prod_general|month|2500',
        recurring: { interval: 'month', interval_count: 1 }
      })
      expect(firstArg(calls, 'checkout.sessions.create')).to.include({
        mode: 'subscription'
      })
    })

    it('should bill a quarterly donation as every three months', async () => {
      const { response, calls } = callCheckout(recurring('quarter'))
      await response

      expect(firstArg(calls, 'prices.list')).to.deep.eq({
        product: 'prod_general',
        lookup_keys: ['prod_general|quarter|2500'],
        recurring: { interval: 'month' }
      })
      expect(
        firstArg<Stripe.PriceCreateParams>(calls, 'prices.create').recurring
      ).to.deep.eq({ interval: 'month', interval_count: 3 })
    })

    it('should bill a yearly donation every year', async () => {
      const { response, calls } = callCheckout(recurring('year'))
      await response

      expect(
        firstArg<Stripe.PriceCreateParams>(calls, 'prices.create').recurring
      ).to.deep.eq({ interval: 'year', interval_count: 1 })
    })

    it('should reject a recurring donation without an interval with a 403 before anything else', async () => {
      for (const body of [
        { ...validBody, isRecurring: true, interval: null },
        { ...validBody, isRecurring: true, interval: '', amount: 0 }
      ]) {
        const { response, calls } = callCheckout(body)
        const result = await response

        expect(result.status).to.eq(403)
        expect(calls).to.have.length(0)
      }
    })

    it('should reject an unknown interval with a 400', async () => {
      const { response, calls } = callCheckout(recurring('weekly'))
      const result = await response

      expect(result.status).to.eq(400)
      expect(await result.json()).to.deep.eq({
        errors: ['Invalid donation interval']
      })
      expect(calls).to.have.length(0)
    })
  })

  describe('validation', () => {
    it('should accept the minimum and maximum amounts', async () => {
      for (const [amount, cents] of [
        [1, 100],
        [10000, 1000000]
      ]) {
        const { response, calls } = callCheckout({ ...validBody, amount })
        expect((await response).status).to.eq(200)
        expect(firstArg(calls, 'prices.create')).to.include({
          unit_amount: cents
        })
      }
    })

    for (const amount of [0.99, 0, -5, 10000.01, 'abc', null]) {
      it(`should reject amount ${JSON.stringify(amount)} with a 400 and never query Stripe`, async () => {
        const { response, calls } = callCheckout({ ...validBody, amount })
        const result = await response

        expect(result.status).to.eq(400)
        expect(await result.json()).to.deep.eq({ errors: ['Invalid amount'] })
        expect(calls).to.have.length(0)
      })
    }

    it('should reject a missing amount', async () => {
      const bodyWithoutAmount: Partial<typeof validBody> = { ...validBody }
      delete bodyWithoutAmount.amount
      const { response, calls } = callCheckout(bodyWithoutAmount)

      expect((await response).status).to.eq(400)
      expect(calls).to.have.length(0)
    })

    for (const [field, value] of [
      ['email', 'not-an-email'],
      ['email', ''],
      ['stripeProductId', 'price_123'],
      ['stripeProductId', '']
    ]) {
      it(`should reject ${field} ${JSON.stringify(value)} with a 400`, async () => {
        const { response, calls } = callCheckout({
          ...validBody,
          [field]: value
        })

        expect((await response).status).to.eq(400)
        expect(calls).to.have.length(0)
      })
    }

    it('should reject a body that is not valid JSON', async () => {
      const { response } = callCheckout(
        null,
        {},
        testEnv,
        new Request('http://localhost/api/checkout', {
          method: 'POST',
          body: '{not json'
        })
      )

      expect((await response).status).to.eq(400)
    })

    for (const body of [null, [], 'text', 42]) {
      it(`should reject a ${JSON.stringify(body)} body with a 400`, async () => {
        const { response, calls } = callCheckout(body)

        expect((await response).status).to.eq(400)
        expect(calls).to.have.length(0)
      })
    }
  })

  describe('product lookup', () => {
    it('should reject a product Stripe does not know with a 400 and create no price', async () => {
      const { response, calls } = callCheckout(validBody, {
        'products.retrieve': async () => {
          throw new Stripe.errors.StripeInvalidRequestError({
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: 'No such product'
          })
        }
      })
      const result = await response

      expect(result.status).to.eq(400)
      expect(await result.json()).to.deep.eq({ errors: ['Invalid product'] })
      expect(calls.map(call => call.method)).to.deep.eq(['products.retrieve'])
    })

    it('should reject an inactive or deleted product with a 400', async () => {
      for (const unavailable of [
        { ...product, active: false },
        { id: 'prod_general', deleted: true }
      ]) {
        const { response, calls } = callCheckout(validBody, {
          'products.retrieve': async () => unavailable
        })

        expect((await response).status).to.eq(400)
        expect(calls.map(call => call.method)).to.deep.eq(['products.retrieve'])
      }
    })

    it('should treat other Stripe failures as a 500 through the route wrapper', async () => {
      const { stripe } = fakeStripe({
        ...defaultMethods,
        'products.retrieve': async () => {
          throw new Error('Stripe is down')
        }
      })

      const result = await withErrorHandling(() =>
        handleCheckout(
          jsonRequest('http://localhost/api/checkout', validBody),
          {
            stripe,
            env: testEnv
          }
        )
      )

      expect(result.status).to.eq(500)
      expect(await result.json()).to.deep.eq({
        errors: ['Internal server error']
      })
    })
  })

  it('should surface a session creation failure as a 500 through the route wrapper', async () => {
    const { stripe } = fakeStripe({
      ...defaultMethods,
      'checkout.sessions.create': async () => {
        throw new Error('Invalid price')
      }
    })

    const result = await withErrorHandling(() =>
      handleCheckout(jsonRequest('http://localhost/api/checkout', validBody), {
        stripe,
        env: testEnv
      })
    )

    expect(result.status).to.eq(500)
  })
})
