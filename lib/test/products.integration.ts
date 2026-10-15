import { expect } from 'chai'
import { withErrorHandling } from '../api-response'
import { handleProducts } from '../handlers/products'
import { fakeStripe, testEnv } from './helpers'

const searchResult = {
  data: [
    {
      id: 'prod_general',
      name: 'General Fund|one-time',
      metadata: { type: 'one-time' }
    },
    {
      id: 'prod_scholarship',
      name: 'Scholarship Fund',
      metadata: { type: 'one-time' }
    }
  ]
}

const callProducts = (type: string, methods = {}) => {
  const { stripe, calls } = fakeStripe({
    'products.search': async () => searchResult,
    ...methods
  })
  const response = handleProducts(
    new Request(`http://localhost/api/products/${type}`),
    { stripe, env: testEnv },
    { params: Promise.resolve({ type }) }
  )
  return { response, calls }
}

describe('#GET /api/products/[type]', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = () => undefined
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  for (const type of ['one-time', 'recurring']) {
    it(`should search Stripe for active ${type} products and map them for the UI`, async () => {
      const { response, calls } = callProducts(type)
      const result = await response

      expect(result.status).to.eq(200)
      expect(await result.json()).to.deep.eq({
        products: [
          {
            stripeId: 'prod_general',
            productName: 'General Fund|one-time',
            productType: 'one-time'
          },
          {
            stripeId: 'prod_scholarship',
            productName: 'Scholarship Fund',
            productType: 'one-time'
          }
        ]
      })
      expect(calls).to.deep.eq([
        {
          method: 'products.search',
          args: [{ query: `active: 'true' AND metadata['type']: '${type}'` }]
        }
      ])
    })
  }

  it('should return an empty list when Stripe has no matching products', async () => {
    const { response } = callProducts('recurring', {
      'products.search': async () => ({ data: [] })
    })

    expect(await (await response).json()).to.deep.eq({ products: [] })
  })

  for (const type of ['donation', '', "x' OR active:'true"]) {
    it(`should reject type ${JSON.stringify(type)} with a 400 and never query Stripe`, async () => {
      const { response, calls } = callProducts(type)
      const result = await response

      expect(result.status).to.eq(400)
      expect((await result.json()).errors[0]).to.contain('one-time, recurring')
      expect(calls).to.have.length(0)
    })
  }

  it('should surface a Stripe failure as a 500 through the route wrapper', async () => {
    const { stripe } = fakeStripe({
      'products.search': async () => {
        throw new Error('Stripe is down')
      }
    })

    const result = await withErrorHandling(() =>
      handleProducts(
        new Request('http://localhost/api/products/one-time'),
        { stripe, env: testEnv },
        { params: Promise.resolve({ type: 'one-time' }) }
      )
    )

    expect(result.status).to.eq(500)
    expect(await result.json()).to.deep.eq({
      errors: ['Internal server error']
    })
  })
})
